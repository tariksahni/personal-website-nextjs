/**
 * POST /.netlify/functions/wardrobe-tryon-status   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Request:  { "key": "<try-on key>" }
 * Response: { "status": "pending" }                     still generating — poll again in ~4s
 *           { "status": "done" }                        {uid}/tryons/{key}.png is ready (signed URL on the client)
 *           { "status": "error", "error": "<message>" } also saved as {uid}/tryons/{key}.error.json
 *           { "status": "none" }                        nothing running for this key
 *
 * The OpenAI response id is read from {uid}/tryons/{key}.pending.json in the user's storage,
 * never from the client. On completion the PNG is saved and the stored OpenAI response is deleted.
 */
const { withHandler, parseBody } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { status } = require('./_lib/tryon')

exports.handler = withHandler(async (event) => {
  const session = await requireOwner(event)
  return status(session, parseBody(event))
})
