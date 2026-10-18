/**
 * POST /.netlify/functions/wardrobe-tryon-start   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Starts a virtual try-on: edits one of the owner's stored photos so they wear the
 * given closet items. Uses OpenAI's Responses API in background mode with the image_generation
 * tool, so this function returns in a few seconds (Netlify sync limit) while OpenAI works.
 *
 * Request:  { "itemIds": [uuid, ...], "outfitName"?: string, "photo"?: 1 | 2 (default 1),
 *             "key": "<first 32 hex of sha256(sorted unique ids joined by ',')>" + ("-p2" when photo is 2) }
 *           photo 1 = {uid}/me/photo.jpg, photo 2 = {uid}/me/photo2.jpg
 *           or { "mode": "test" }  (TEMP: text-only low-quality test image, key "test-<ms>")
 * Response: { "status": "pending", "key", "responseId"?, "alreadyRunning"? }
 *           Then poll wardrobe-tryon-status with { key }.
 * Errors:   { "error": "<readable message>" }  (OpenAI errors also saved to {uid}/tryons/{key}.error.json)
 */
const { withHandler, parseBody } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { start } = require('./_lib/tryon')

exports.handler = withHandler(async (event) => {
  const session = await requireOwner(event) // verifies the token before doing anything
  return start(session, parseBody(event))
})
