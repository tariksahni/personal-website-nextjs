/**
 * POST /.netlify/functions/wardrobe-suggest   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Request:  { "occasion": "office"|"casual"|"special",
 *             "specialNote"?: string,      // required when occasion = "special" (<= 300 chars)
 *             "date": "YYYY-MM-DD" }       // owner's LOCAL date
 * Response: { "occasion": "office", "date": "2026-10-11", "specialNote": null,
 *             "outfits": [ { "name": string, "item_ids": [uuid, ...], "reason": string } ],  // 1-3 outfits
 *             "cooldownRelaxed": boolean,  // true if recently-worn tops had to be included
 *             "generatedAt": ISO timestamp,
 *             "saved": boolean }           // whether it was cached in wardrobe_suggestions
 *           The same object minus "saved" is stored as wardrobe_suggestions.payload,
 *           keyed by (user_id, for_date = date, occasion).
 * Errors:   { "error": "<readable message>" }  // 422 if closet lacks a top or bottom
 *
 * All Supabase reads/writes use the caller's token, so RLS applies.
 */
const { withHandler, parseBody, HttpError } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { callModel, extractJson } = require('./_lib/ai')

const TOP_COOLDOWN_DAYS = 4
const MIN_TOPS = 3
const HISTORY_DAYS = 14
const OCCASIONS = ['office', 'casual', 'special']

const OCCASION_TEXT = {
  office: 'a regular office day (smart casual to business casual unless the closet is mostly casual)',
  casual: 'a casual day off / weekend',
  special: 'a special occasion described by the user',
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function restClient({ supabaseUrl, anonKey, token }) {
  const base = `${supabaseUrl}/rest/v1`
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  return {
    async get(path) {
      let res
      try {
        res = await fetch(`${base}/${path}`, { headers })
      } catch (e) {
        throw new HttpError(502, 'Could not reach the database.')
      }
      if (!res.ok) {
        console.error(`[wardrobe] rest GET ${path.split('?')[0]} -> ${res.status}`)
        throw new HttpError(502, 'Could not load your wardrobe. Has the database migration been run?')
      }
      return res.json()
    },
    async upsert(table, row, onConflict) {
      try {
        const res = await fetch(`${base}/${table}?on_conflict=${onConflict}`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(row),
        })
        if (!res.ok) console.error(`[wardrobe] rest upsert ${table} -> ${res.status}`)
        return res.ok
      } catch (e) {
        console.error(`[wardrobe] rest upsert ${table} failed`)
        return false
      }
    },
  }
}

// Returns { allowed: Item[], cooldownRelaxed } applying the top cooldown rule.
function applyTopCooldown(items, wearLog, date) {
  const cooldownStart = addDays(date, -TOP_COOLDOWN_DAYS)
  const lastWorn = new Map() // item id -> latest worn_on (before today)
  for (const row of wearLog) {
    if (!row || row.worn_on >= date) continue // today's log is replaceable; ignore it
    for (const id of row.item_ids || []) {
      if (!lastWorn.has(id) || lastWorn.get(id) < row.worn_on) lastWorn.set(id, row.worn_on)
    }
  }
  const tops = items.filter((i) => i.category === 'top')
  const isCooling = (i) => lastWorn.has(i.id) && lastWorn.get(i.id) >= cooldownStart
  const freshTops = tops.filter((i) => !isCooling(i))
  let cooldownRelaxed = false
  const allowedTops = [...freshTops]
  if (allowedTops.length < MIN_TOPS) {
    const cooling = tops
      .filter(isCooling)
      .sort((a, b) => (lastWorn.get(a.id) < lastWorn.get(b.id) ? -1 : 1))
    while (allowedTops.length < MIN_TOPS && cooling.length) {
      allowedTops.push(cooling.shift())
      cooldownRelaxed = true
    }
  }
  const allowed = items.filter((i) => i.category !== 'top').concat(allowedTops)
  return { allowed, cooldownRelaxed }
}

// Keeps only outfits made of known ids that satisfy the category rules.
function validateOutfits(rawOutfits, allowed) {
  const byId = new Map(allowed.map((i) => [i.id, i]))
  const hasShoes = allowed.some((i) => i.category === 'shoes')
  const seen = new Set()
  const out = []
  for (const o of Array.isArray(rawOutfits) ? rawOutfits : []) {
    if (!o || typeof o !== 'object') continue
    const ids = [...new Set((Array.isArray(o.item_ids) ? o.item_ids : []).filter((id) => byId.has(id)))]
    const count = (cat) => ids.filter((id) => byId.get(id).category === cat).length
    if (count('top') !== 1 || count('bottom') !== 1) continue
    if (hasShoes ? count('shoes') !== 1 : count('shoes') > 0) continue
    if (count('outerwear') > 1 || count('accessory') > 2) continue
    const key = [...ids].sort().join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Outfit',
      item_ids: ids,
      reason: typeof o.reason === 'string' ? o.reason.trim().slice(0, 200) : '',
    })
    if (out.length === 3) break
  }
  return out
}

function compactItem(i) {
  const o = { id: i.id, cat: i.category }
  if (i.subcategory) o.type = i.subcategory
  if (i.colors && i.colors.length) o.colors = i.colors
  if (i.pattern) o.pattern = i.pattern
  if (i.formality) o.formality = i.formality
  if (i.description) o.desc = i.description
  return o
}

const SYSTEM = `You are a personal stylist choosing outfits from the user's own closet.
Reply with ONLY a JSON object: {"outfits":[{"name":string,"item_ids":[string],"reason":string}]} with exactly 3 different outfits.
Rules: use only ids from the closet list; each outfit has exactly one "top" and exactly one "bottom", exactly one "shoes" item if any shoes exist, and optionally one "outerwear" item (jacket, blazer, overshirt, coat) — include one when it suits the occasion or adds polish — and up to two "accessory" items.
Prefer varied tops across the 3 outfits, coherent colours and formality for the occasion, and avoid repeating recent full outfits.
name: 2-4 words. reason: one short sentence (max 20 words) on why it works.`

exports.handler = withHandler(async (event) => {
  const auth = await requireOwner(event)
  const body = parseBody(event)

  const occasion = body.occasion
  if (!OCCASIONS.includes(occasion)) throw new HttpError(400, 'occasion must be office, casual or special.')
  const date = body.date
  if (!validDate(date)) throw new HttpError(400, 'date must be YYYY-MM-DD.')
  const specialNote = typeof body.specialNote === 'string' ? body.specialNote.trim().slice(0, 300) : ''
  if (occasion === 'special' && !specialNote) throw new HttpError(400, 'Describe the special day first.')

  const rest = restClient(auth)
  const since = addDays(date, -HISTORY_DAYS)
  const [items, profiles, wearLog] = await Promise.all([
    rest.get('wardrobe_items?select=id,category,subcategory,colors,pattern,formality,description&category=not.is.null'),
    rest.get('wardrobe_profile?select=profile_text,notes&limit=1'),
    rest.get(`wardrobe_wear_log?select=worn_on,item_ids&worn_on=gte.${since}&order=worn_on.desc`),
  ])

  if (!items.some((i) => i.category === 'top') || !items.some((i) => i.category === 'bottom')) {
    throw new HttpError(422, 'Add at least one top and one bottom to your closet first.')
  }

  const { allowed, cooldownRelaxed } = applyTopCooldown(items, wearLog, date)
  const profile = profiles[0] || {}
  const recent = wearLog
    .filter((r) => r.worn_on < date)
    .slice(0, 7)
    .map((r) => `${r.worn_on}: ${(r.item_ids || []).join(', ')}`)

  const prompt = [
    `Occasion: ${OCCASION_TEXT[occasion]}.`,
    specialNote ? `Special day details: ${specialNote}` : '',
    profile.profile_text ? `About me: ${profile.profile_text}` : '',
    profile.notes ? `My notes: ${profile.notes}` : '',
    recent.length ? `Recently worn (date: item ids):\n${recent.join('\n')}` : '',
    `Closet (JSON):\n${JSON.stringify(allowed.map(compactItem))}`,
    'Return the JSON now.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const text = await callModel({ system: SYSTEM, content: prompt, maxTokens: 4000, effort: 'low', json: true })
  const parsed = extractJson(text)
  const outfits = validateOutfits(parsed && parsed.outfits, allowed)
  if (!outfits.length) throw new HttpError(502, "Couldn't put together valid outfits. Please try again.")

  const payload = {
    occasion,
    date,
    specialNote: specialNote || null,
    outfits,
    cooldownRelaxed,
    generatedAt: new Date().toISOString(),
  }
  const saved = await rest.upsert(
    'wardrobe_suggestions',
    { user_id: auth.user.id, for_date: date, occasion, payload, created_at: payload.generatedAt },
    'user_id,for_date,occasion'
  )
  return { ...payload, saved }
})

exports._applyTopCooldown = applyTopCooldown
exports._validateOutfits = validateOutfits
