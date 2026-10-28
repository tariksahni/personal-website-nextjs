/**
 * POST /.netlify/functions/wardrobe-ai-start   (owner only; Authorization: Bearer <supabase access token>)
 *
 * Starts an async AI job (OpenAI Responses API, background mode) and returns in a few seconds.
 * Request:  { "type": "suggest" | "tag", "params": { ... } }
 *   suggest params: { mode: "office"|"special"|"anchor"|"request", date: "YYYY-MM-DD", includeJacket?,
 *                     specialNote?, anchorId?, request? (<= 500 chars), avoid? [[uuid,...],...] }  (see _lib/suggest.js)
 *   tag params:     { itemId: uuid, apply?: boolean (default true) }                              (see _lib/tag.js)
 * Response: { "jobId": "<32 hex>", "type", "status": "pending" }  → poll wardrobe-ai-status with { jobId }.
 * Errors:   { "error": "<readable message>" }
 *
 * Env: OPENAI_API_KEY; optional OPENAI_STYLIST_MODEL (default gpt-6-astra), OPENAI_STYLIST_EFFORT (default medium),
 *      OPENAI_STYLIST_IMAGE_DETAIL (default: high for <= 40 closet items, low above).
 */
const { withHandler, parseBody } = require('./_lib/http')
const { requireOwner } = require('./_lib/auth')
const { startJob } = require('./_lib/jobs')
const suggest = require('./_lib/suggest')
const tag = require('./_lib/tag')

exports.handler = withHandler(async (event) => {
  const session = await requireOwner(event) // verifies the token before doing anything
  return startJob(session, parseBody(event), { suggest, tag })
})
