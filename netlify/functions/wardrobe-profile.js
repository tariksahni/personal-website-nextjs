/**
 * POST /.netlify/functions/wardrobe-profile   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Request:  { "imageBase64"?: "<base64 photo of the owner>", "mediaType"?: "image/jpeg"|"image/png"|"image/webp",
 *             "notes"?: "free text, e.g. height, build, style preferences (<= 1000 chars)" }
 *           At least one of imageBase64 / notes is required.
 * Response: { "profileText": "<= ~120 words style profile" }
 *           The photo is never stored; the client saves profileText (editable) to wardrobe_profile itself.
 * Errors:   { "error": "<readable message>" }
 */
const { withHandler, parseBody, HttpError } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { callModel } = require('./_lib/ai')

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64_LEN = 5 * 1024 * 1024

const SYSTEM = `You are a friendly personal stylist writing a short style profile that another AI will later use to pick outfits.
Using the photo (if given) and the person's notes, write at most 120 words of plain text (no markdown, no headings) covering:
apparent skin undertone, build/proportions, colours that suit them, fits/silhouettes that suit them, and what to avoid.
Be respectful and practical. Do not comment on attractiveness, weight judgements, age, or identity. If something is unclear from the photo, say so briefly rather than guessing.`

exports.handler = withHandler(async (event) => {
  await requireOwner(event)
  const body = parseBody(event)

  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : ''
  let data = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : ''
  let mediaType = typeof body.mediaType === 'string' ? body.mediaType.toLowerCase() : ''
  const m = /^data:([^;]+);base64,(.*)$/s.exec(data)
  if (m) {
    mediaType = mediaType || m[1].toLowerCase()
    data = m[2]
  }
  if (!data && !notes) throw new HttpError(400, 'Add a photo or some notes first.')

  const content = []
  if (data) {
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
    if (!mediaType) mediaType = 'image/jpeg'
    if (!MEDIA_TYPES.includes(mediaType)) throw new HttpError(400, 'Unsupported image type. Please use JPEG or PNG.')
    if (data.length > MAX_BASE64_LEN) throw new HttpError(413, 'Image is too large. Please resize it.')
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) throw new HttpError(400, 'imageBase64 is not valid base64.')
    content.push({ type: 'image', mediaType, data: data.replace(/\s+/g, '') })
  }
  content.push({
    type: 'text',
    text: notes ? `My notes: ${notes}\n\nWrite my style profile.` : 'Write my style profile.',
  })

  const text = await callModel({ system: SYSTEM, content, maxTokens: 3000, effort: 'low' })
  const profileText = text.trim().replace(/^```\w*\s*|\s*```$/g, '').slice(0, 1500)
  return { profileText }
})
