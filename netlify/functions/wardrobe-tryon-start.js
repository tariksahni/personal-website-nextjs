/**
 * POST /.netlify/functions/wardrobe-tryon-start   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Starts a virtual try-on: edits the owner's stored photo ({uid}/me/photo.jpg) so they wear the
 * given closet items. Uses OpenAI's Responses API in background mode with the image_generation
 * tool, so this function returns in a few seconds (Netlify sync limit) while OpenAI works.
 *
 * Request:  { "itemIds": [uuid, ...], "outfitName"?: string,
 *             "key": "<first 32 hex of sha256(sorted unique ids joined by ',')>" }
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
