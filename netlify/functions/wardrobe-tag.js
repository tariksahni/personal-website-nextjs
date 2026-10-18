/**
 * POST /.netlify/functions/wardrobe-tag   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Request:  { "imageBase64": "<base64, no data: prefix needed>", "mediaType": "image/jpeg" | "image/png" | "image/webp" }
 * Response: { "tags": {
 *              "category": "top"|"bottom"|"shoes"|"outerwear"|"accessory"|null,
 *              "subcategory": string|null,          // e.g. "oxford shirt"
 *              "colors": string[],                  // lowercase, max 4
 *              "pattern": string|null,              // e.g. "solid", "striped"
 *              "formality": "casual"|"smart_casual"|"formal"|null,
 *              "seasons": string[],                 // subset of spring/summer/autumn/winter
 *              "description": string                // short, <= 140 chars
 *           } }
 * Errors:   { "error": "<readable message>" } with 400/401/403/405/422/5xx.
 */
const { withHandler, parseBody, HttpError } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { callModel, extractJson } = require('./_lib/ai')

const CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessory']
const FORMALITY = ['casual', 'smart_casual', 'formal']
const SEASONS = ['spring', 'summer', 'autumn', 'winter']
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64_LEN = 5 * 1024 * 1024 // ~3.7MB decoded

const SYSTEM = `You tag clothing photos for a personal wardrobe app.
Reply with ONLY a JSON object, no prose, with keys:
category: one of ${CATEGORIES.join(', ')} (dresses/suits count as "top"; jackets, blazers, coats, hoodies worn over a top are "outerwear"),
subcategory: precise short noun phrase that names the construction detail that matters for styling:
  - tops: ALWAYS name the collar/neckline: "mandarin collar" (band / Chinese / Nehru collar — a short stand-up band with no fold-down points), "spread collar", "button-down collar", "cuban collar" (camp collar), "polo collar", "crew neck", "v-neck", "henley", "turtleneck", "hooded"; then the garment, and "short-sleeve" if so. e.g. "mandarin collar linen shirt", "short-sleeve cuban collar shirt", "crew neck t-shirt", "mandarin collar kurta".
  - bottoms: ALWAYS name the exact type, never just "pants": "jeans" (any denim), "chinos" (cotton twill, slanted pockets), "trousers" (tailored / formal, often creased), "joggers", "cargo pants", "shorts"; add fit/wash if visible. e.g. "slim dark-wash jeans", "straight beige chinos", "grey formal trousers".
  - outerwear: e.g. "navy blazer", "denim jacket", "bomber jacket", "overshirt", "puffer jacket".
  - shoes: e.g. "white sneakers", "brown loafers", "black derby shoes", "chelsea boots".
Look closely at the collar: a mandarin collar has NO collar points or fold — do not call it a regular collar.
colors: array of 1-4 simple lowercase colour names, dominant first,
pattern: one word or short phrase (e.g. "solid", "striped", "checked", "floral", "graphic"),
formality: one of ${FORMALITY.join(', ')},
seasons: array, subset of ${SEASONS.join(', ')},
description: one short sentence (max 25 words) a stylist would find useful, mentioning collar/neckline, sleeve length and fit for tops, or fabric and fit for bottoms.
If several garments are visible, tag the most prominent one.`

function normaliseImage(body) {
  let data = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : ''
  let mediaType = typeof body.mediaType === 'string' ? body.mediaType.toLowerCase() : ''
  const m = /^data:([^;]+);base64,(.*)$/s.exec(data)
  if (m) {
    mediaType = mediaType || m[1].toLowerCase()
    data = m[2]
  }
  if (!data) throw new HttpError(400, 'imageBase64 is required.')
  if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
  if (!mediaType) mediaType = 'image/jpeg'
  if (!MEDIA_TYPES.includes(mediaType)) {
    throw new HttpError(400, 'Unsupported image type. Please use JPEG or PNG.')
  }
  if (data.length > MAX_BASE64_LEN) throw new HttpError(413, 'Image is too large. Please resize it.')
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) throw new HttpError(400, 'imageBase64 is not valid base64.')
  return { data: data.replace(/\s+/g, ''), mediaType }
}

function str(v, max = 80) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function normaliseTags(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const category = typeof r.category === 'string' ? r.category.toLowerCase().trim() : ''
  let formality = typeof r.formality === 'string' ? r.formality.toLowerCase().trim().replace(/[\s-]+/g, '_') : ''
  const colors = (Array.isArray(r.colors) ? r.colors : typeof r.colors === 'string' ? [r.colors] : [])
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim().toLowerCase().slice(0, 30))
    .slice(0, 4)
  const seasons = (Array.isArray(r.seasons) ? r.seasons : [])
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim().toLowerCase())
    .map((s) => (s === 'fall' ? 'autumn' : s))
    .filter((s, i, a) => SEASONS.includes(s) && a.indexOf(s) === i)
  return {
    category: CATEGORIES.includes(category) ? category : null,
    subcategory: str(r.subcategory),
    colors,
    pattern: str(r.pattern, 40),
    formality: FORMALITY.includes(formality) ? formality : null,
    seasons,
    description: str(r.description, 140) || '',
  }
}

exports.handler = withHandler(async (event) => {
  await requireOwner(event)
  const body = parseBody(event)
  const { data, mediaType } = normaliseImage(body)

  const text = await callModel({
    system: SYSTEM,
    maxTokens: 2000,
    effort: 'low',
    json: true,
    content: [
      { type: 'image', mediaType, data },
      { type: 'text', text: 'Tag this item. JSON only.' },
    ],
  })
  return { tags: normaliseTags(extractJson(text)) }
})

exports._normaliseTags = normaliseTags
