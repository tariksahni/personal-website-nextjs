// Job type "suggest": outfit suggestions from the owner's closet, with VISION (every candidate item's photo
// is sent as an input_image via a 1h Supabase signed URL, labelled "i12: top — mandarin collar linen shirt (white)").
//
// params {
//   mode: 'office' | 'special' | 'anchor' | 'request',
//   date: 'YYYY-MM-DD' (owner's local date), includeJacket?: boolean,
//   specialNote?: string (special: required, <= 300; anchor: optional occasion),
//   anchorId?: uuid (anchor: every outfit includes it),
//   request?: string (request: required, <= 500 chars; TOP priority),
//   avoid?: [[uuid, ...], ...] (anchor/request: combos on screen now, max 30)
// }
// Outfits: office 7, special 3, anchor 7, request 7.
// office/special → saved to wardrobe_suggestions (user_id = ownerId, for_date = date, occasion = mode) exactly as
// the old wardrobe-suggest did (payload { occasion, date, specialNote, includeJacket, outfits, cooldownRelaxed,
// generatedAt }); refresh avoidance uses the previously stored outfits. anchor/request → not stored; avoidance
// uses the client's `avoid`.
// Rules kept from wardrobe-suggest: top cooldown 4 days (anchor top exempt; request mode: soft — cooling tops are
// marked "worn recently, avoid unless asked"), jacket toggle (anchor outerwear forces a jacket; request mode
// allows one outerwear piece when the request asks for it even if the toggle is off), 1 top / 1 bottom /
// 1 shoes if any shoes / <= 1 outerwear / <= 2 accessories, different top per outfit where possible, never
// tucking + fuller-stomach drape preference, profile + notes, recent wear log, fresh-first ordering.
const { HttpError } = require('./http')
const { storageClient } = require('./storage')
const { restClient } = require('./rest')

const TOP_COOLDOWN_DAYS = 4
const MIN_TOPS = 3
const HISTORY_DAYS = 14
const MODES = ['office', 'special', 'anchor', 'request']
const TARGET = { office: 7, special: 3, anchor: 7, request: 7 }
const MAX_AVOID = 30
const MAX_REQUEST = 500
const SIGN_TTL = 3600
// Image detail: OPENAI_STYLIST_IMAGE_DETAIL (low|high|auto|original) overrides; default 'high' for closets of
// up to 40 candidate items, 'low' above that (keeps very large closets within a sensible token budget).
const DETAIL_SWITCH = 40
const DETAILS = ['low', 'high', 'auto', 'original']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const OCCASION_TEXT = {
  office:
    'a day at a relaxed, chill office: ANY item in the closet is fine for work (t-shirts, polos, shirts, jeans, chinos, trousers, sneakers all OK). Aim for put-together, varied everyday looks',
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

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Last worn date (before `date`) per item id. */
function lastWornMap(wearLog, date) {
  const lastWorn = new Map()
  for (const row of wearLog || []) {
    if (!row || row.worn_on >= date) continue // today's log is replaceable; ignore it
    for (const id of row.item_ids || []) {
      if (!lastWorn.has(id) || lastWorn.get(id) < row.worn_on) lastWorn.set(id, row.worn_on)
    }
  }
  return lastWorn
}

// Returns { allowed: Item[], cooldownRelaxed, cooling: Set<id> } applying the top cooldown rule.
function applyTopCooldown(items, wearLog, date, minTops = MIN_TOPS) {
  const cooldownStart = addDays(date, -TOP_COOLDOWN_DAYS)
  const lastWorn = lastWornMap(wearLog, date)
  const tops = items.filter((i) => i.category === 'top')
  const isCooling = (i) => lastWorn.has(i.id) && lastWorn.get(i.id) >= cooldownStart
  const freshTops = tops.filter((i) => !isCooling(i))
  let cooldownRelaxed = false
  const allowedTops = [...freshTops]
  if (allowedTops.length < minTops) {
    const cooling = tops.filter(isCooling).sort((a, b) => (lastWorn.get(a.id) < lastWorn.get(b.id) ? -1 : 1))
    while (allowedTops.length < minTops && cooling.length) {
      allowedTops.push(cooling.shift())
      cooldownRelaxed = true
    }
  }
  const allowed = items.filter((i) => i.category !== 'top').concat(allowedTops)
  return { allowed, cooldownRelaxed, cooling: new Set(tops.filter(isCooling).map((i) => i.id)) }
}

// Keeps only outfits made of known ids that satisfy the category rules. `allowed` = [{ id, category }].
function validateOutfits(rawOutfits, allowed, requireJacket = false, limit = 3) {
  const byId = new Map(allowed.map((i) => [i.id, i]))
  const hasShoes = allowed.some((i) => i.category === 'shoes')
  const needJacket = requireJacket && allowed.some((i) => i.category === 'outerwear')
  const seen = new Set()
  const out = []
  for (const o of Array.isArray(rawOutfits) ? rawOutfits : []) {
    if (!o || typeof o !== 'object') continue
    const ids = [...new Set((Array.isArray(o.item_ids) ? o.item_ids : []).filter((id) => byId.has(id)))]
    const count = (cat) => ids.filter((id) => byId.get(id).category === cat).length
    if (count('top') !== 1 || count('bottom') !== 1) continue
    if (hasShoes ? count('shoes') !== 1 : count('shoes') > 0) continue
    if (count('outerwear') > 1 || count('accessory') > 2) continue
    if (needJacket && count('outerwear') !== 1) continue
    const key = [...ids].sort().join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Outfit',
      item_ids: ids,
      reason: typeof o.reason === 'string' ? o.reason.trim().slice(0, 300) : '',
    })
    if (out.length === limit) break
  }
  return out
}

function describe(i) {
  const type = i.subcategory || i.category
  const colours = (i.colors || []).join('/')
  return `${type}${colours ? ` (${colours})` : ''}`
}

/** "i12: top — mandarin collar linen shirt (white) · checked · smart casual. <description>" */
function label(i, sid, extra) {
  const bits = [i.pattern && i.pattern !== 'solid' ? i.pattern : '', i.formality ? i.formality.replace('_', ' ') : '']
    .filter(Boolean)
    .join(' · ')
  const desc = i.description ? ` ${String(i.description).slice(0, 220)}` : ''
  return `${sid}: ${i.category} — ${describe(i)}${bits ? ` · ${bits}` : ''}.${desc}${extra ? ` ${extra}` : ''}`
}

const INSTRUCTIONS = `You are a talented personal stylist with a sharp eye for colour, texture and fit, putting together outfits from the user's OWN closet. You can SEE a photo of every closet item; each photo is preceded by its id and tags. Trust the photo over the tags when they disagree (true colour, fabric, texture, collar, fit, hem length).
Hard rules:
- Use only item ids from the closet list. Each outfit has exactly one "top" and exactly one "bottom", exactly one "shoes" item if any shoes are listed, at most one "outerwear" item (follow the jacket rule in the request), and at most two "accessory" items.
- Use a DIFFERENT top in every outfit when the closet allows; vary bottoms and shoes too. Never repeat a combination listed under "Already shown".
- The user never tucks in tops and has a slightly fuller stomach: never suggest tucking (no "tucked", "half-tuck", "French tuck"). Prefer tops that drape comfortably over the midsection: straight or slightly curved hems that end around the hip, regular or relaxed fits, structured fabrics (oxford, linen, heavier cotton, piqué), overshirts and open layers. Avoid clingy thin jersey, cropped or boxy-short tops and very long shirttails worn untucked when better options exist.
How to style:
- Build each outfit deliberately: coherent colour story (tonal, complementary or one accent colour), balanced texture (e.g. crisp shirt with soft chinos, knit with denim), matching formality across the pieces, shoes that suit the bottoms, and proportions that flatter (untucked top length vs. rise of the bottoms).
- Respect the user's profile, notes and recent wear (don't repeat yesterday's look).
Output: JSON matching the schema. "outfits" in order of how strongly you recommend them. name: 2-4 evocative words. reason: max 25 words explaining the colour/texture harmony and why the fit works (mention the untucked drape when relevant). "note": one short sentence for the user (e.g. what the closet couldn't satisfy), or "" if nothing to add.`

function outfitSchema(shortIds) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['outfits', 'note'],
    properties: {
      outfits: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'item_ids', 'reason'],
          properties: {
            name: { type: 'string' },
            item_ids: { type: 'array', items: { type: 'string', enum: shortIds } },
            reason: { type: 'string' },
          },
        },
      },
      note: { type: 'string' },
    },
  }
}

function parseAvoid(raw) {
  if (raw === undefined || raw === null) return []
  const okCombo = (c) => Array.isArray(c) && c.length > 0 && c.length <= 12 && c.every((id) => typeof id === 'string' && UUID_RE.test(id))
  if (!Array.isArray(raw) || raw.length > MAX_AVOID || !raw.every(okCombo)) {
    throw new HttpError(400, `avoid must be a list of up to ${MAX_AVOID} outfits (lists of item ids).`)
  }
  return raw.map((c) => c.map((id) => id.toLowerCase()))
}

function parseParams(p) {
  const mode = p.mode
  if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of: ${MODES.join(', ')}.`)
  if (!validDate(p.date)) throw new HttpError(400, 'date must be YYYY-MM-DD.')
  const out = { mode, date: p.date, includeJacket: p.includeJacket === true }
  const note = typeof p.specialNote === 'string' ? p.specialNote.trim().slice(0, 300) : ''
  if (mode === 'special') {
    if (!note) throw new HttpError(400, 'Describe the special day first.')
    out.specialNote = note
  }
  if (mode === 'anchor') {
    const anchorId = typeof p.anchorId === 'string' ? p.anchorId.trim().toLowerCase() : ''
    if (!UUID_RE.test(anchorId)) throw new HttpError(400, 'anchorId must be a closet item id.')
    out.anchorId = anchorId
    if (note) out.specialNote = note
  }
  if (mode === 'request') {
    const request = typeof p.request === 'string' ? p.request.trim() : ''
    if (!request) throw new HttpError(400, 'Tell the stylist what you want first.')
    if (request.length > MAX_REQUEST) throw new HttpError(400, `Keep the request under ${MAX_REQUEST} characters.`)
    out.request = request
  }
  if (mode === 'anchor' || mode === 'request') out.avoid = parseAvoid(p.avoid)
  return out
}

function imageDetail(count) {
  const env = (process.env.OPENAI_STYLIST_IMAGE_DETAIL || '').trim().toLowerCase()
  if (DETAILS.includes(env)) return env
  return count > DETAIL_SWITCH ? 'low' : 'high'
}

async function prepare(session, rawParams) {
  const params = parseParams(rawParams)
  const { mode, date } = params
  const ownerId = session.ownerId || session.user.id
  const rest = restClient(session)
  const since = addDays(date, -HISTORY_DAYS)
  const needPrev = mode === 'office' || mode === 'special'
  const [items, profiles, wearLog, prevRows] = await Promise.all([
    rest.get('wardrobe_items?select=id,image_path,category,subcategory,colors,pattern,formality,seasons,description&category=not.is.null'),
    rest.get('wardrobe_profile?select=profile_text,notes&limit=1'),
    rest.get(`wardrobe_wear_log?select=worn_on,item_ids&worn_on=gte.${since}&order=worn_on.desc`),
    needPrev
      ? rest.get(`wardrobe_suggestions?select=payload&for_date=eq.${date}&occasion=eq.${mode}&limit=1`).catch(() => [])
      : Promise.resolve([]),
  ])

  let anchor = null
  if (mode === 'anchor') {
    anchor = items.find((i) => String(i.id).toLowerCase() === params.anchorId) || null
    if (!anchor) {
      // Distinguish "not in your closet" from "not tagged yet" (the list above only has tagged items).
      const rows = await rest.get(`wardrobe_items?select=id&id=eq.${params.anchorId}&limit=1`).catch(() => [])
      if (rows && rows.length) throw new HttpError(422, 'Tag that item (give it a category) before styling around it.')
      throw new HttpError(404, "That item isn't in your closet anymore.")
    }
  }
  if (!items.some((i) => i.category === 'top') || !items.some((i) => i.category === 'bottom')) {
    throw new HttpError(422, 'Add at least one top and one bottom to your closet first.')
  }

  const target = TARGET[mode]
  const lastWorn = lastWornMap(wearLog, date)
  let cooled
  if (anchor && anchor.category === 'top') cooled = { allowed: items, cooldownRelaxed: false, cooling: new Set() }
  else cooled = applyTopCooldown(items, wearLog, date, Math.max(MIN_TOPS, target))
  let cooldownRelaxed = cooled.cooldownRelaxed
  let softCooling = new Set()
  let allowed = cooled.allowed
  if (mode === 'request') {
    // The request is top priority: keep every top, but mark recently-worn ones.
    allowed = items
    softCooling = cooled.cooling
    cooldownRelaxed = false
  }

  // Jackets: toggle on (or an outerwear anchor) → required; request mode → allowed when the request asks for one.
  const wantJacket = params.includeJacket || !!(anchor && anchor.category === 'outerwear')
  if (!wantJacket && mode !== 'request') allowed = allowed.filter((i) => i.category !== 'outerwear')
  if (anchor) {
    // Anchor top/bottom/shoes/outerwear is the only candidate in its category; accessories can sit alongside it.
    const exclusive = anchor.category !== 'accessory'
    allowed = allowed.filter((i) => i.id !== anchor.id && !(exclusive && i.category === anchor.category)).concat(anchor)
  }
  const hasJackets = allowed.some((i) => i.category === 'outerwear')
  let jacketRule
  if (wantJacket && hasJackets) jacketRule = 'Jacket rule: every outfit must include exactly one "outerwear" item (jacket, blazer, overshirt or coat).'
  else if (mode === 'request' && hasJackets) {
    jacketRule = 'Jacket rule: include one "outerwear" item only if the request asks for a jacket / overshirt / layer or names an outerwear piece; otherwise none.'
  } else jacketRule = 'Jacket rule: do not include any "outerwear" item.'
  const profile = profiles[0] || {}

  // Short ids i1..iN (stable for this job) <-> real ids.
  const toShort = new Map()
  allowed.forEach((it, idx) => toShort.set(it.id, `i${idx + 1}`))
  const shortIds = allowed.map((it) => toShort.get(it.id))
  const itemById = new Map(items.map((i) => [i.id, i]))
  const refList = (ids) => (ids || []).map((id) => toShort.get(id) || (itemById.get(id) ? describe(itemById.get(id)) : null)).filter(Boolean)

  const recent = wearLog
    .filter((r) => r.worn_on < date)
    .slice(0, 7)
    .map((r) => ({ d: r.worn_on, ids: refList(r.item_ids) }))
    .filter((r) => r.ids.length)
    .map((r) => `${r.d}: ${r.ids.join(', ')}`)

  // Refresh: office/special avoid what's stored for today; anchor/request avoid what the client has on screen.
  let prevOutfits = []
  if (needPrev) prevOutfits = (prevRows[0] && prevRows[0].payload && prevRows[0].payload.outfits) || []
  else {
    const realId = new Map(items.map((i) => [String(i.id).toLowerCase(), i.id]))
    prevOutfits = (params.avoid || []).map((c) => ({ item_ids: c.map((id) => realId.get(id) || id) }))
  }
  const comboKey = (ids) => [...ids].sort().join(',')
  const shownKeys = [...new Set(prevOutfits.map((o) => comboKey(o.item_ids || [])))]
  const shownLines = prevOutfits.map((o) => refList(o.item_ids).join(', ')).filter(Boolean)

  const count = target + 2 // a couple of spares survive validation / fresh-first filtering
  const occasionText = mode === 'request' ? null
    : mode === 'special' || (mode === 'anchor' && params.specialNote) ? OCCASION_TEXT.special : OCCASION_TEXT.office
  const anchorLine = anchor
    ? `Every outfit MUST include item ${toShort.get(anchor.id)} (${describe(anchor)}). Build each outfit around it and vary the other pieces as much as possible across outfits (different ${['top', 'bottom', 'shoes'].filter((c) => c !== anchor.category).join(', ')} each time where the closet allows).`
    : ''
  const requestLines = mode === 'request'
    ? [
        `THE USER'S REQUEST (TOP PRIORITY — follow every stated constraint: colours, items to include or exclude, vibe, occasion, weather):\n"""${params.request}"""`,
        'If the closet cannot satisfy part of the request, still give the closest outfits and say exactly what is missing in each affected reason and in "note". The request overrides general preferences, but never the hard rules.',
      ]
    : []

  const intro = [
    occasionText ? `Occasion: ${occasionText}.` : '',
    ...requestLines,
    `Suggest ${count} different outfits.`,
    anchorLine,
    params.specialNote ? `Special day details: ${params.specialNote}` : '',
    jacketRule,
    profile.profile_text ? `About me: ${profile.profile_text}` : '',
    profile.notes ? `My notes: ${profile.notes}` : '',
    recent.length ? `Recently worn (date: items):\n${recent.join('\n')}` : '',
    softCooling.size ? 'Tops marked "worn recently" were worn in the last 4 days: avoid them unless the request asks for them.' : '',
    shownLines.length ? `Already shown (do NOT repeat these combinations):\n${shownLines.join('\n')}` : '',
    `Closet (${allowed.length} items; each label is followed by its photo):`,
  ]
    .filter(Boolean)
    .join('\n\n')

  // Photos: signed URLs (1h) created as the user; only objects in the owner's folder.
  const own = allowed.filter((i) => i.image_path && String(i.image_path).startsWith(`${ownerId}/`))
  const urls = await storageClient(session).signUrls(own.map((i) => i.image_path), SIGN_TTL)
  const detail = imageDetail(allowed.length)
  const content = [{ type: 'input_text', text: intro }]
  // Shuffled order each time, so a Refresh explores different parts of the closet.
  for (const it of shuffle(allowed)) {
    const sid = toShort.get(it.id)
    const extra = [
      softCooling.has(it.id) ? `(worn recently, ${lastWorn.get(it.id)})` : '',
      urls[it.image_path] ? '' : '(no photo)',
    ].filter(Boolean).join(' ')
    content.push({ type: 'input_text', text: label(it, sid, extra) })
    if (urls[it.image_path]) content.push({ type: 'input_image', image_url: urls[it.image_path], detail })
  }
  content.push({ type: 'input_text', text: `Now return ${count} outfits as JSON.` })

  return {
    params,
    ctx: {
      items: allowed.map((it) => [toShort.get(it.id), it.id, it.category]),
      anchorId: anchor ? anchor.id : null,
      requireJacket: !!(wantJacket && hasJackets),
      shownKeys,
      target,
      cooldownRelaxed,
    },
    request: {
      instructions: INSTRUCTIONS,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'outfits', strict: true, schema: outfitSchema(shortIds) } },
      max_output_tokens: 32000,
    },
  }
}

async function finish(session, job, parsed) {
  const params = job.params || {}
  const ctx = job.ctx || {}
  const triples = Array.isArray(ctx.items) ? ctx.items : []
  const toReal = new Map(triples.map(([sid, id]) => [sid, id]))
  const allowed = triples.map(([, id, category]) => ({ id, category }))
  const raw = ((parsed && parsed.outfits) || []).map((o) => ({
    ...o,
    item_ids: (Array.isArray(o && o.item_ids) ? o.item_ids : []).map((x) => toReal.get(String(x).trim()) || String(x)),
  }))

  let valid = validateOutfits(raw, allowed, !!ctx.requireJacket, raw.length || 1)
  if (ctx.anchorId) valid = valid.filter((o) => o.item_ids.includes(ctx.anchorId))
  const shown = new Set(ctx.shownKeys || [])
  const key = (ids) => [...ids].sort().join(',')
  // Prefer combinations that weren't on screen before; only fall back to them if the closet is small.
  const outfits = valid.filter((o) => !shown.has(key(o.item_ids))).concat(valid.filter((o) => shown.has(key(o.item_ids)))).slice(0, ctx.target || 7)
  if (!outfits.length) throw new HttpError(502, "Couldn't put together valid outfits. Please try again.")
  const note = parsed && typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 300) : ''
  const generatedAt = new Date().toISOString()
  const cooldownRelaxed = !!ctx.cooldownRelaxed

  if (params.mode === 'anchor') {
    return {
      mode: 'anchor',
      anchorId: ctx.anchorId,
      occasion: params.specialNote ? 'special' : 'office',
      date: params.date,
      specialNote: params.specialNote || null,
      includeJacket: !!ctx.requireJacket || !!params.includeJacket,
      outfits,
      note,
      cooldownRelaxed,
      generatedAt,
    }
  }
  if (params.mode === 'request') {
    return { mode: 'request', request: params.request, date: params.date, includeJacket: !!params.includeJacket, outfits, note, cooldownRelaxed, generatedAt }
  }

  const payload = {
    occasion: params.mode,
    date: params.date,
    specialNote: params.specialNote || null,
    includeJacket: !!params.includeJacket,
    outfits,
    cooldownRelaxed,
    generatedAt,
  }
  const saved = await restClient(session).upsert(
    'wardrobe_suggestions',
    { user_id: session.ownerId || session.user.id, for_date: params.date, occasion: params.mode, payload, created_at: generatedAt },
    'user_id,for_date,occasion'
  )
  return { ...payload, mode: params.mode, note, saved }
}

module.exports = { prepare, finish, applyTopCooldown, validateOutfits, parseParams, imageDetail, INSTRUCTIONS }
