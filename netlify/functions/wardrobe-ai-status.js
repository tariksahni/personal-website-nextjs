/**
 * POST /.netlify/functions/wardrobe-ai-status   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Request:  { "jobId": "<32 hex>" }
 * Response: { "status": "pending", jobId }                       still working — poll again in ~3s
 *           { "status": "done", jobId, type, result }            suggest → outfits payload; tag → { item, tags }
 *           { "status": "error", jobId, error: "<message>" }
 *
 * The OpenAI response id is read from {ownerId}/jobs/{jobId}.pending.json in the owner's storage, never from
 * the client. On completion the result is post-processed/persisted and the stored OpenAI response is deleted.
 * Polling a finished job again returns the same result (saved as {jobId}.result.json).
 */
const { withHandler, parseBody } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { statusJob } = require('./_lib/jobs')
const suggest = require('./_lib/suggest')
const tag = require('./_lib/tag')

exports.handler = withHandler(async (event) => {
  const session = await requireOwner(event)
  return statusJob(session, parseBody(event), { suggest, tag })
})
