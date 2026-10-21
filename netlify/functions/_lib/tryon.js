// Virtual try-on core: OpenAI Responses API in BACKGROUND mode with the image_generation tool,
// driven by two short synchronous Netlify functions (legacy plans: no background functions, 10s limit).
//
//   wardrobe-tryon-start  → downloads photos (user token), POST /v1/responses {background:true}, writes pending.json
//   wardrobe-tryon-status → reads pending.json (never trusts a client responseId), GET /v1/responses/{id};
//                           on completion uploads the PNG and DELETEs the stored OpenAI response.
//
// Storage protocol (private "wardrobe" bucket, all as the USER so RLS applies):
//   {uid}/me/photo.jpg               owner Photo 1 (uploaded by the client)
//   {uid}/me/photo2.jpg              owner Photo 2 (optional, e.g. with specs instead of sunglasses)
//   {uid}/tryons/{key}.pending.json  { responseId, startedAt, mode, photo } while OpenAI is working
//   {uid}/tryons/{key}.png           result (upsert)
//   {uid}/tryons/{key}.error.json    { error, code, at } on failure (removed on start / success)
// key = first 32 hex chars of sha256(sorted unique lower-case item ids joined by ","), or "test-<ms>".
// Photo 2 looks use the same hash + "-p2" (Photo 1 keys are unchanged, so existing looks still resolve).
const crypto = require('crypto')
const { HttpError } = require('./http')
const { storageClient } = require('./storage')

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
// Verified 2026-10-18 (OpenAI image_generation tool guide): gpt-4.1 is a supported mainline model.
const DEFAULT_TRYON_MODEL = 'gpt-4.1'
// gpt-image-2 always processes inputs at high fidelity (input_fidelity must be omitted for it).
const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_QUALITY = 'high' // quality first; OPENAI_IMAGE_QUALITY overrides (test mode stays low)
const MAX_ITEMS = 6
const PENDING_FRESH_MS = 10 * 60 * 1000
const OPENAI_TIMEOUT_MS = 6000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const KEY_RE = /^(?:[0-9a-f]{32}(?:-p2)?|test-\d{10,16})$/
const PHOTO_FILES = { 1: 'photo.jpg', 2: 'photo2.jpg' }
const CATEGORY_ORDER = ['top', 'outerwear', 'bottom', 'shoes', 'accessory']
const TEST_PROMPT =
  'Generate a flat-lay product photo of a folded navy oxford shirt, beige chinos and white sneakers on a light wooden surface, soft daylight.'

function normaliseIds(ids) {
  return Array.from(new Set((ids || []).map((x) => String(x).trim().toLowerCase()))).sort()
}

/** Must match src/lib/wardrobe/tryon.js → tryOnKey(). Photo 1 keeps the original formula. */
function tryOnKey(itemIds, photo = 1) {
  const hash = crypto.createHash('sha256').update(normaliseIds(itemIds).join(',')).digest('hex').slice(0, 32)
  return photo === 2 ? `${hash}-p2` : hash
}

function parsePhoto(v) {
  if (v === undefined || v === null || v === '') return 1
  const n = Number(v)
  if (n === 1 || n === 2) return n
  throw new HttpError(400, 'photo must be 1 or 2.')
}

// Reads width/height from JPEG (SOF marker) or PNG (IHDR) bytes. Returns null if unknown.
function imageSize(buf) {
  if (!buf || buf.length < 24) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null
    const marker = buf[i + 1]
    if (marker === 0xff) {
      i += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const len = buf.readUInt16BE(i + 2)
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    i += 2 + len
  }
  return null
}

// Output size matching the owner photo's orientation (portrait if unknown).
function sizeFor(dims) {
  if (!dims || !dims.width || !dims.height) return '1024x1536'
  const r = dims.width / dims.height
  if (r > 1.15) return '1536x1024'
  if (r < 0.87) return '1024x1536'
  return '1024x1024'
}

function describe(item) {
  const bits = [item.category, item.subcategory, (item.colors || []).join('/'), item.pattern]
    .filter((x) => x && String(x).trim())
    .join(', ')
  const desc = item.description ? ` — ${String(item.description).slice(0, 160)}` : ''
  return `${bits || 'garment'}${desc}`
}

// Construction details the image model tends to "normalise" away (e.g. every collar becomes a
// standard shirt collar, every bottom becomes generic pants). Spelled out as must-keep rules.
const DETAIL_RULES = [
  [/mandarin|band collar|chinese collar|nehru|stand[- ]?(up )?collar|grandad/, 'MANDARIN (band / Chinese) collar: a short stand-up band around the neck with NO fold-down collar points and NO lapels. Do not draw a regular shirt collar.'],
  [/button[- ]down/, 'button-down collar: collar points fastened to the shirt with small buttons.'],
  [/cuban|camp collar|resort collar/, 'cuban / camp collar: a flat, open collar lying on the chest, with no collar stand.'],
  [/polo/, 'polo collar: soft knit collar with a short buttoned placket.'],
  [/crew neck|round neck/, 'crew neck: round neckline with no collar.'],
  [/v[- ]neck/, 'v-neck: V-shaped neckline with no collar.'],
  [/henley/, 'henley: round collarless neckline with a short button placket.'],
  [/turtle ?neck|roll ?neck/, 'turtleneck: high folded neck, no collar.'],
  [/jean|denim/, 'JEANS: denim fabric with visible twill texture, five-pocket jeans construction, contrast stitching and rivets. Not chinos, not formal trousers.'],
  [/chino/, 'CHINOS: smooth cotton twill (NOT denim), slanted front pockets, casual flat front, no crease. Not jeans, not formal trousers.'],
  [/trouser|slacks|formal pant|dress pant/, 'TROUSERS: tailored formal trousers in smooth suiting fabric with a pressed front crease and clean waistband. Not jeans, not chinos.'],
  [/jogger|track ?pant|sweatpant/, 'JOGGERS: soft knit fabric with elastic waistband and cuffed ankles.'],
  [/cargo/, 'CARGO PANTS: with side cargo pockets on the thighs.'],
  [/shorts/, 'SHORTS: above the knee.'],
  [/short[- ]sleeve|half[- ]sleeve/, 'short sleeves (not full sleeves).'],
  [/kurta/, 'KURTA: long tunic reaching mid-thigh or knee, not a regular shirt.'],
]

function mustKeep(item) {
  const text = [item.subcategory, item.description].filter(Boolean).join(' ').toLowerCase()
  const rules = DETAIL_RULES.filter(([re]) => re.test(text)).map(([, rule]) => rule)
  if (!rules.length && item.category === 'top') rules.push('copy the collar / neckline exactly as shown in its image.')
  if (!rules.length && item.category === 'bottom') rules.push('copy the exact trouser type, fabric and fit shown in its image.')
  return rules.length ? ` MUST KEEP: ${rules.join(' ')}` : ''
}

function buildPrompt(items) {
  const lines = items.map((it, i) => `Image ${i + 2}: ${describe(it)}.${mustKeep(it)}`)
  const cats = Array.from(new Set(items.map((it) => it.category).filter(Boolean)))
  return [
    `Edit image 1: replace only the person's clothing with the garments shown in the other images (${cats.join(', ') || 'garments'} as given); keep everything else identical.`,
    'Image 1 is the base photo to edit. Keep the same person exactly: face, facial features, expression, hair, skin tone, body shape and proportions.',
    'Keep the original pose, background, lighting, framing, crop and camera angle unchanged.',
    'Keep eyewear exactly as in image 1 — if the person wears glasses/specs keep the same frames; if sunglasses keep sunglasses; if none, add none. Do not add, remove or change glasses, watches, jewellery or headwear unless they are one of the listed garments.',
    'Dress the person in exactly these garments, faithfully matching their colour, pattern, fabric, cut and details, fitted naturally to the body with realistic drape, folds and shadows:',
    ...lines,
    'Wear every top UNTUCKED: the shirt / t-shirt / kurta hem hangs loose and naturally over the waistband of the bottoms — never tucked in, not half-tucked. Tops sit with a relaxed, comfortable fit through the stomach and waist (not tight or clinging), draping naturally over the midsection.',
    "Keep the person's real body shape, weight and stomach exactly as in image 1 — do not slim, flatten or reshape the body.",
    "Reproduce each garment's construction exactly from its image and the MUST KEEP notes: collar or neckline type, sleeve length, closures, pockets, and whether the bottom is jeans, chinos or trousers. Never substitute a standard shirt collar or generic pants.",
    'Any clothing category not listed above stays exactly as it is in image 1. Do not add, remove or restyle anything else. Photorealistic result, no text or watermarks.',
  ].join('\n')
}

const INSTRUCTIONS =
  'You are a virtual try-on photo editor. Call the image_generation tool exactly once, passing the user instructions through faithfully. ' +
  'When input images are given, edit the FIRST image (the person) and use the others only as garment references. Do not reply with text.'

const SAFETY_MSG = "OpenAI's safety system blocked this try-on. Try a different photo of yourself or different garments."

function mapOpenAIError(status, err, model) {
  const e = (err && err.error) || {}
  const code = String(e.code || e.type || '')
  const msg = typeof e.message === 'string' ? e.message.slice(0, 200) : ''
  if (/moderation|safety|content_policy/i.test(code) || /safety system|moderation|content policy/i.test(msg)) {
    return { status: 422, code: 'moderation_blocked', message: SAFETY_MSG }
  }
  if (status === 429) {
    if (code === 'insufficient_quota' || /quota|billing/i.test(msg)) {
      return { status: 503, code: 'insufficient_quota', message: 'Your OpenAI account is out of credits (insufficient quota). Add billing on platform.openai.com, then try again.' }
    }
    return { status: 503, code: 'rate_limited', message: 'OpenAI rate limit reached. Wait a minute and try again.' }
  }
  if (status === 401) return { status: 502, code: 'auth', message: 'OpenAI rejected the API key. Check OPENAI_API_KEY in Netlify.' }
  if (status === 403) {
    return /verif/i.test(msg)
      ? { status: 502, code: 'org_verification', message: `OpenAI requires organization verification for image generation (${model}). Verify your org on platform.openai.com.` }
      : { status: 502, code: 'forbidden', message: `OpenAI denied access to ${model}.${msg ? ` ${msg}` : ''}` }
  }
  if (status === 404 || code === 'model_not_found') {
    return { status: 502, code: 'model_not_found', message: `Model "${model}" isn't available on this OpenAI account. Set OPENAI_TRYON_MODEL / OPENAI_IMAGE_MODEL.` }
  }
  if (status === 400) {
    return { status: 422, code: code || 'bad_request', message: `OpenAI couldn't process this request${msg ? `: ${msg}` : '.'}` }
  }
  if (status >= 500) return { status: 503, code: 'openai_unavailable', message: 'OpenAI is having trouble right now. Please try again shortly.' }
  return { status: 502, code: code || `http_${status}`, message: `Image generation failed (OpenAI ${status}).` }
}

class TryOnError extends HttpError {
  constructor(status, code, message) {
    super(status, message)
    this.code = code
  }
}

async function openai(method, path, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
  try {
    return await fetch(`${OPENAI_RESPONSES_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    throw new TryOnError(502, 'network', 'Could not reach OpenAI. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}

async function readErr(res) {
  try {
    return await res.json()
  } catch (e) {
    return null
  }
}

/** Best-effort: remove the stored response (and its input photos) from OpenAI. */
async function deleteResponse(id) {
  try {
    const res = await openai('DELETE', `/${encodeURIComponent(id)}`)
    if (!res.ok && res.status !== 404) console.error(`[wardrobe] openai delete response -> ${res.status}`)
  } catch (e) {
    console.error('[wardrobe] openai delete response failed')
  }
}

function requireOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(500, 'Server not configured: OPENAI_API_KEY is not set (needed for try-on).')
  }
}

function validateStartBody(body) {
  if (body.mode === 'test') return { mode: 'test', ids: [], key: `test-${Date.now()}`, photo: 1 }
  const photo = parsePhoto(body.photo)
  const raw = Array.isArray(body.itemIds) ? body.itemIds : null
  if (!raw || raw.length === 0) throw new HttpError(400, 'Pick at least one item to try on.')
  const ids = normaliseIds(raw)
  if (ids.length > MAX_ITEMS) throw new HttpError(400, `Too many items (max ${MAX_ITEMS}).`)
  if (!ids.every((id) => UUID_RE.test(id))) throw new HttpError(400, 'itemIds must be item UUIDs.')
  const key = tryOnKey(ids, photo)
  if (typeof body.key !== 'string' || body.key.toLowerCase() !== key) throw new HttpError(400, 'Invalid try-on key.')
  return { mode: 'tryon', ids, key, photo }
}

async function loadItems({ supabaseUrl, anonKey, token }, ids) {
  let res
  try {
    res = await fetch(
      `${supabaseUrl}/rest/v1/wardrobe_items?select=id,image_path,category,subcategory,colors,pattern,description&id=in.(${ids.join(',')})`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
    )
  } catch (e) {
    throw new HttpError(502, 'Could not reach the database.')
  }
  if (!res.ok) {
    console.error(`[wardrobe] rest GET wardrobe_items -> ${res.status}`)
    throw new HttpError(502, 'Could not load your closet items.')
  }
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.image_path)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
}

const dataUrl = (buf, type = 'image/jpeg') => `data:${type};base64,${buf.toString('base64')}`
const paths = (uid, key) => {
  const dir = `${uid}/tryons`
  return { dir, png: `${dir}/${key}.png`, err: `${dir}/${key}.error.json`, pending: `${dir}/${key}.pending.json` }
}
const stamp = (o) => Date.parse((o && (o.updated_at || o.created_at)) || '') || 0

async function saveError(store, p, code, message) {
  try {
    await store.upload(p.err, JSON.stringify({ error: message, code, at: new Date().toISOString() }), 'application/json')
  } catch (e) {
    // ignore; the response still carries the message
  }
}

/** POST body { itemIds, outfitName?, key, photo?: 1|2 } or { mode: 'test' } → { status: 'pending', key, responseId } */
async function start(session, body) {
  requireOpenAIKey()
  const { mode, ids, key, photo: slot } = validateStartBody(body)
  const uid = session.ownerId || session.user.id // shared wardrobe: owner's folder
  const store = storageClient(session)
  const p = paths(uid, key)

  if (mode === 'tryon') {
    const existing = await store.list(p.dir, key)
    const pending = existing.find((o) => o.name === `${key}.pending.json`)
    if (pending && Date.now() - stamp(pending) < PENDING_FRESH_MS) {
      return { status: 'pending', key, photo: slot, alreadyRunning: true }
    }
  }

  const tryonModel = (process.env.OPENAI_TRYON_MODEL || '').trim() || DEFAULT_TRYON_MODEL
  const imageModel = (process.env.OPENAI_IMAGE_MODEL || '').trim() || DEFAULT_IMAGE_MODEL
  const tool = { type: 'image_generation', model: imageModel, output_format: 'png' }
  let content

  if (mode === 'test') {
    Object.assign(tool, { quality: 'low', size: '1024x1024', action: 'generate' })
    content = [{ type: 'input_text', text: TEST_PROMPT }]
  } else {
    const [photo, items] = await Promise.all([store.download(`${uid}/me/${PHOTO_FILES[slot]}`), loadItems(session, ids)])
    if (!photo) {
      throw new TryOnError(400, 'no_photo', slot === 2 ? 'Add your photo (Photo 2) in the Me tab first.' : 'Add your photo in the Me tab first.')
    }
    const owned = items.filter((it) => it.image_path.startsWith(`${uid}/`))
    if (owned.length === 0) throw new TryOnError(400, 'no_items', 'None of these items are in your closet any more.')
    const bufs = await Promise.all(owned.map((it) => store.download(it.image_path)))
    const usable = owned.filter((it, i) => bufs[i])
    if (usable.length === 0) throw new TryOnError(400, 'no_items', "Couldn't load the photos of these items.")

    Object.assign(tool, {
      quality: (process.env.OPENAI_IMAGE_QUALITY || '').trim() || DEFAULT_QUALITY,
      size: sizeFor(imageSize(photo)),
      action: 'edit',
    })
    // Older GPT Image models default to low input fidelity; gpt-image-2+ rejects the parameter.
    if (/^gpt-image-1/.test(imageModel)) tool.input_fidelity = 'high'
    content = [
      { type: 'input_text', text: buildPrompt(usable) },
      // detail 'high' (Responses input_image: low|high|auto|original; gpt-4.1 has no 'original').
      { type: 'input_image', image_url: dataUrl(photo), detail: 'high' }, // image 1 = the person (base to edit)
      ...bufs.filter(Boolean).map((b) => ({ type: 'input_image', image_url: dataUrl(b), detail: 'high' })),
    ]
  }

  await store.remove([p.err])
  const res = await openai('POST', '', {
    model: tryonModel,
    background: true,
    store: true, // required to poll a background response after ~10 min; deleted on completion
    instructions: INSTRUCTIONS,
    input: [{ role: 'user', content }],
    tools: [tool],
    tool_choice: { type: 'image_generation' },
  })
  if (!res.ok) {
    const mapped = mapOpenAIError(res.status, await readErr(res), `${tryonModel} / ${imageModel}`)
    console.error(`[wardrobe] openai create response -> ${res.status} (${mapped.code})`)
    await saveError(store, p, mapped.code, mapped.message)
    throw new TryOnError(mapped.status, mapped.code, mapped.message)
  }
  const created = await res.json()
  if (!created || !created.id) throw new TryOnError(502, 'empty', 'OpenAI did not accept the request. Please try again.')

  try {
    await store.upload(
      p.pending,
      JSON.stringify({ responseId: created.id, startedAt: new Date().toISOString(), mode, photo: slot }),
      'application/json'
    )
  } catch (e) {
    try {
      await openai('POST', `/${encodeURIComponent(created.id)}/cancel`)
    } catch (e2) {
      // ignore
    }
    await deleteResponse(created.id)
    throw e
  }
  return { status: 'pending', key, photo: slot, responseId: created.id }
}

function failureMessage(resp) {
  const err = (resp && resp.error) || {}
  const code = String(err.code || '')
  const msg = typeof err.message === 'string' ? err.message.slice(0, 200) : ''
  if (/moderation|safety|content_policy/i.test(code) || /safety|moderation|content policy/i.test(msg)) {
    return { code: 'moderation_blocked', message: SAFETY_MSG }
  }
  if (/rate_limit/i.test(code)) return { code, message: 'OpenAI rate limit reached. Wait a minute and try again.' }
  if (resp && resp.status === 'incomplete') {
    const reason = resp.incomplete_details && resp.incomplete_details.reason
    if (reason === 'content_filter') return { code: 'moderation_blocked', message: SAFETY_MSG }
    return { code: 'incomplete', message: `Image generation stopped early${reason ? ` (${reason})` : ''}. Please try again.` }
  }
  if (resp && resp.status === 'cancelled') return { code: 'cancelled', message: 'Image generation was cancelled.' }
  return { code: code || 'failed', message: `Image generation failed${msg ? `: ${msg}` : '.'}` }
}

function extractImage(resp) {
  const call = (resp.output || []).find((o) => o && o.type === 'image_generation_call' && typeof o.result === 'string' && o.result)
  return call ? Buffer.from(call.result, 'base64') : null
}

function outputText(resp) {
  return (resp.output || [])
    .filter((o) => o && o.type === 'message')
    .flatMap((o) => o.content || [])
    .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
    .join(' ')
    .trim()
    .slice(0, 200)
}

/** POST body { key } → { status: 'pending' | 'done' | 'error' | 'none', error? } */
async function status(session, body) {
  requireOpenAIKey()
  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : ''
  if (!KEY_RE.test(key)) throw new HttpError(400, 'Invalid try-on key.')
  const uid = session.ownerId || session.user.id // shared wardrobe: owner's folder
  const store = storageClient(session)
  const p = paths(uid, key)

  const listing = await store.list(p.dir, key)
  const has = (suffix) => listing.find((o) => o.name === `${key}${suffix}`)
  const png = has('.png')
  const pendingObj = has('.pending.json')

  const errorResult = async () => {
    const buf = await store.download(p.err)
    let message = 'Generating the look failed.'
    try {
      message = JSON.parse(buf.toString('utf8')).error || message
    } catch (e) {
      // keep default
    }
    return { status: 'error', error: message }
  }

  if (!pendingObj) {
    if (png) return { status: 'done' }
    if (has('.error.json')) return errorResult()
    return { status: 'none' }
  }

  let pending = null
  try {
    const buf = await store.download(p.pending)
    pending = buf ? JSON.parse(buf.toString('utf8')) : null
  } catch (e) {
    pending = null
  }
  const responseId = pending && typeof pending.responseId === 'string' ? pending.responseId : ''
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(responseId)) {
    await store.remove([p.pending])
    return png ? { status: 'done' } : { status: 'none' }
  }

  const res = await openai('GET', `/${encodeURIComponent(responseId)}`)
  if (res.status === 404) {
    // Another poll already finished (and deleted) it, or it expired.
    await store.remove([p.pending])
    const again = await store.list(p.dir, key)
    if (again.find((o) => o.name === `${key}.png`)) return { status: 'done' }
    if (again.find((o) => o.name === `${key}.error.json`)) return errorResult()
    const message = 'This generation expired. Please try again.'
    await saveError(store, p, 'expired', message)
    return { status: 'error', error: message }
  }
  if (!res.ok) {
    const mapped = mapOpenAIError(res.status, await readErr(res), 'responses')
    console.error(`[wardrobe] openai get response -> ${res.status} (${mapped.code})`)
    if (res.status === 429 || res.status >= 500) return { status: 'pending' } // transient; keep polling
    throw new TryOnError(mapped.status, mapped.code, mapped.message)
  }
  const resp = await res.json()

  if (resp.status === 'queued' || resp.status === 'in_progress') return { status: 'pending' }

  const image = resp.status === 'completed' ? extractImage(resp) : null
  if (image) {
    await store.upload(p.png, image, 'image/png')
    await store.remove([p.pending, p.err])
    await deleteResponse(responseId)
    return { status: 'done' }
  }

  let failure
  if (resp.status === 'completed') {
    const text = outputText(resp)
    failure = /safety|policy|can't|cannot|unable/i.test(text)
      ? { code: 'moderation_blocked', message: SAFETY_MSG }
      : { code: 'no_image', message: `OpenAI didn't return an image${text ? `: “${text}”` : ''}. Please try again.` }
  } else {
    failure = failureMessage(resp)
  }
  console.error(`[wardrobe] tryon response ${resp.status} (${failure.code})`)
  await saveError(store, p, failure.code, failure.message)
  await store.remove([p.pending])
  await deleteResponse(responseId)
  return { status: 'error', error: failure.message }
}

module.exports = {
  start,
  status,
  tryOnKey,
  imageSize,
  sizeFor,
  buildPrompt,
  mapOpenAIError,
  DEFAULT_TRYON_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_QUALITY,
  PHOTO_FILES,
}
