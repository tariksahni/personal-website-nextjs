// Job type "tag": tag one closet item from its stored photo (vision, detail high).
//   params { itemId: uuid, apply?: boolean (default true) }
//   start:  loads the row (user token), signs its image URL (1h) and sends it as input_image.
//   finish: normalises the tags; apply=true → PATCH the row, KEEPING existing colours (the owner fixes colours
//           by hand; AI colours only fill an empty list) → { item, tags }. apply=false → { tags } only (review).
const { HttpError } = require('./http')
const { storageClient } = require('./storage')
const { restClient } = require('./rest')

const CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessory']
const FORMALITY = ['casual', 'smart_casual', 'formal']
const SEASONS = ['spring', 'summer', 'autumn', 'winter']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIGN_TTL = 3600

const INSTRUCTIONS = `You are an expert menswear stylist tagging clothing photos for a personal wardrobe app. Study the photo closely (zoom into the collar, fabric texture, seams, pockets, hem and fit) before answering.
Fields:
category: one of ${CATEGORIES.join(', ')} (dresses/suits count as "top"; jackets, blazers, coats, overshirts, shackets, cardigans and hoodies worn open over a top are "outerwear"; belts, watches, bags, caps, scarves, sunglasses are "accessory").
subcategory: precise short noun phrase naming the construction detail that matters for styling:
  - tops: ALWAYS name the collar/neckline: "mandarin collar" (band / Chinese / Nehru collar — a short stand-up band with no fold-down points), "spread collar", "button-down collar", "cuban collar" (camp collar), "polo collar", "crew neck", "v-neck", "henley", "turtleneck", "hooded"; then fabric if clear (linen, oxford, denim, knit, jersey…), the garment, and "short-sleeve" if so. e.g. "mandarin collar linen shirt", "short-sleeve cuban collar shirt", "crew neck t-shirt", "mandarin collar kurta", "piqué polo shirt".
  - bottoms: ALWAYS name the exact type, never just "pants": "jeans" (any denim: visible twill, five pockets, rivets, contrast stitching), "chinos" (smooth cotton twill, slanted front pockets, no crease), "trousers" (tailored / formal suiting fabric, often a pressed crease), "joggers", "cargo pants", "shorts"; add fit and wash/colour if visible. e.g. "slim dark-wash jeans", "straight beige chinos", "grey pleated trousers".
  - outerwear: e.g. "navy blazer", "denim jacket", "bomber jacket", "olive overshirt", "puffer jacket", "knit cardigan".
  - shoes: e.g. "white leather sneakers", "brown suede loafers", "black derby shoes", "tan chelsea boots".
Look closely at the collar: a mandarin collar has NO collar points or fold — never call it a regular collar. Do not confuse chinos with jeans: denim has a diagonal twill weave with a white weft and usually contrast stitching.
colors: 1-4 simple lowercase colour names a person would use (e.g. "navy", "olive", "off-white", "rust", "charcoal"), dominant first; judge the true colour, correcting for lighting and white balance.
pattern: "solid", "striped", "pinstriped", "checked", "plaid", "houndstooth", "floral", "paisley", "printed", "graphic", "textured" etc.
formality: one of ${FORMALITY.join(', ')}.
seasons: subset of ${SEASONS.join(', ')} the fabric/weight suits (linen → spring/summer, heavy wool/flannel → autumn/winter, most cotton → three or four seasons).
description: one or two short sentences (max 35 words) a stylist would use: fabric and texture, collar/neckline, sleeve length, fit (slim / regular / relaxed / boxy), hem shape and length for tops (straight hem, curved shirttail, boxy/cropped, long — important because the owner never tucks tops in), rise and leg shape for bottoms, notable details.
If several garments are visible, tag the most prominent one. Reply with the JSON object only.`

const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'subcategory', 'colors', 'pattern', 'formality', 'seasons', 'description'],
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    subcategory: { type: 'string' },
    colors: { type: 'array', items: { type: 'string' } },
    pattern: { type: 'string' },
    formality: { type: 'string', enum: FORMALITY },
    seasons: { type: 'array', items: { type: 'string', enum: SEASONS } },
    description: { type: 'string' },
  },
}

function str(v, max = 80) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function normaliseTags(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const category = typeof r.category === 'string' ? r.category.toLowerCase().trim() : ''
  const formality = typeof r.formality === 'string' ? r.formality.toLowerCase().trim().replace(/[\s-]+/g, '_') : ''
  const colors = (Array.isArray(r.colors) ? r.colors : typeof r.colors === 'string' ? [r.colors] : [])
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim().toLowerCase().slice(0, 30))
    .filter((c, i, a) => a.indexOf(c) === i)
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
    description: str(r.description, 240) || '',
  }
}

async function loadItem(rest, itemId) {
  const rows = await rest.get(`wardrobe_items?select=id,image_path,colors&id=eq.${itemId}&limit=1`)
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function prepare(session, params) {
  const itemId = typeof params.itemId === 'string' ? params.itemId.trim().toLowerCase() : ''
  if (!UUID_RE.test(itemId)) throw new HttpError(400, 'itemId must be a closet item id.')
  const apply = params.apply !== false
  const ownerId = session.ownerId || session.user.id
  const rest = restClient(session)
  const item = await loadItem(rest, itemId)
  if (!item) throw new HttpError(404, "That item isn't in your closet anymore.")
  if (!item.image_path || !String(item.image_path).startsWith(`${ownerId}/`)) {
    throw new HttpError(400, 'This item has no photo in your closet.')
  }
  const urls = await storageClient(session).signUrls([item.image_path], SIGN_TTL)
  const url = urls[item.image_path]
  if (!url) throw new HttpError(502, "Couldn't access this item's photo in storage.")

  return {
    params: { itemId, apply },
    ctx: {},
    request: {
      instructions: INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Tag this clothing item.' },
            { type: 'input_image', image_url: url, detail: 'high' },
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: 'clothing_tags', strict: true, schema: TAG_SCHEMA } },
      max_output_tokens: 16000,
    },
  }
}

async function finish(session, job, parsed) {
  const tags = normaliseTags(parsed)
  const { itemId, apply } = job.params || {}
  if (!tags.category) throw new HttpError(502, "The AI couldn't tell what this item is. Tag it by hand.")
  if (apply === false) return { itemId, tags }

  const rest = restClient(session)
  // Re-read now: the owner may have fixed colours while the job ran.
  const current = await loadItem(rest, itemId)
  if (!current) throw new HttpError(404, 'This item was deleted while it was being tagged.')
  const { colors, ...rest0 } = tags
  const patch = Array.isArray(current.colors) && current.colors.length ? rest0 : { ...rest0, colors }
  const rows = await rest.patch('wardrobe_items', `id=eq.${itemId}`, patch)
  const item = Array.isArray(rows) && rows[0] ? rows[0] : null
  if (!item) throw new HttpError(404, 'This item was deleted while it was being tagged.')
  return { itemId, item, tags }
}

module.exports = { prepare, finish, normaliseTags, INSTRUCTIONS, TAG_SCHEMA }
