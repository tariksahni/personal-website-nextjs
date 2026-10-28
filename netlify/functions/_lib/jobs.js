// Generic async AI jobs: OpenAI Responses API in BACKGROUND mode, driven by two short sync functions
// (legacy Netlify plan: no background functions, 10s sync limit). Same pattern as try-on (_lib/tryon.js).
//
//   wardrobe-ai-start  { type, params }  → job.prepare() builds the request, POST /v1/responses
//                                          { background: true, store: true }, writes the pending file → { jobId }
//   wardrobe-ai-status { jobId }         → reads the pending file (responseId NEVER comes from the client),
//                                          GET /v1/responses/{id}; when finished: job.finish() post-processes and
//                                          persists, the result is saved, the pending file removed and the
//                                          stored OpenAI response DELETEd (privacy: it references closet photos).
//
// Storage protocol (private "wardrobe" bucket, as the USER so RLS applies; always the OWNER's folder):
//   {ownerId}/jobs/{jobId}.pending.json  { responseId, type, params, ctx, startedAt }
//   {ownerId}/jobs/{jobId}.result.json   { type, result, finishedAt }      (makes status idempotent)
//   {ownerId}/jobs/{jobId}.error.json    { error, code, at }
// jobId = 32 random hex chars (crypto). Result/error files older than a day are cleaned up on later starts.
const crypto = require('crypto')
const { HttpError } = require('./http')
const { storageClient } = require('./storage')

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
// Verified 2026-10-28 (developers.openai.com/api/docs/models/gpt-6-astra): "Our most capable model",
// text+image input, Responses API, structured outputs, reasoning effort low|medium|high|xhigh|max.
// The background-mode guide's examples use gpt-6-astra. OPENAI_STYLIST_MODEL overrides.
const DEFAULT_MODEL = 'gpt-6-astra'
const DEFAULT_EFFORT = 'medium'
const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const OPENAI_TIMEOUT_MS = 7000
const JOB_ID_RE = /^[0-9a-f]{32}$/
const RESPONSE_ID_RE = /^[A-Za-z0-9_-]{1,200}$/
const MAX_JOB_MS = 15 * 60 * 1000 // a job still running after this is cancelled
const KEEP_FILES_MS = 24 * 60 * 60 * 1000

function stylistModel() {
  return (process.env.OPENAI_STYLIST_MODEL || '').trim() || DEFAULT_MODEL
}

// Reasoning effort is only sent to reasoning models (gpt-5*/gpt-6*/o-series) and only with a known value.
function reasoningFor(model) {
  if (!/^(gpt-5|gpt-6|gpt-7|o\d)/i.test(model)) return null
  let effort = (process.env.OPENAI_STYLIST_EFFORT || '').trim().toLowerCase() || DEFAULT_EFFORT
  if (!EFFORTS.includes(effort)) effort = DEFAULT_EFFORT
  return { effort }
}

function newJobId() {
  return crypto.randomBytes(16).toString('hex')
}

class JobError extends HttpError {
  constructor(status, code, message) {
    super(status, message)
    this.code = code
  }
}

const SAFETY_MSG = "OpenAI's safety system blocked this request. Try again, or change the photo / request."

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
      ? { status: 502, code: 'org_verification', message: `OpenAI requires organization verification to use ${model}. Verify your org on platform.openai.com, or set OPENAI_STYLIST_MODEL to another model.` }
      : { status: 502, code: 'forbidden', message: `OpenAI denied access to ${model}.${msg ? ` ${msg}` : ''}` }
  }
  if (status === 404 || code === 'model_not_found') {
    return { status: 502, code: 'model_not_found', message: `Model "${model}" isn't available on this OpenAI account. Set OPENAI_STYLIST_MODEL in Netlify.` }
  }
  if (status === 400) {
    return { status: 422, code: code || 'bad_request', message: `OpenAI couldn't process this request${msg ? `: ${msg}` : '.'}` }
  }
  if (status >= 500) return { status: 503, code: 'openai_unavailable', message: 'OpenAI is having trouble right now. Please try again shortly.' }
  return { status: 502, code: code || `http_${status}`, message: `The AI request failed (OpenAI ${status}).` }
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
    throw new JobError(502, 'network', 'Could not reach OpenAI. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}

async function readJson(res) {
  try {
    return await res.json()
  } catch (e) {
    return null
  }
}

/** Best-effort: remove the stored response (and its references to closet photos) from OpenAI. */
async function deleteResponse(id) {
  try {
    const res = await openai('DELETE', `/${encodeURIComponent(id)}`)
    if (!res.ok && res.status !== 404) console.error(`[wardrobe] openai delete response -> ${res.status}`)
  } catch (e) {
    console.error('[wardrobe] openai delete response failed')
  }
}

async function cancelResponse(id) {
  try {
    await openai('POST', `/${encodeURIComponent(id)}/cancel`)
  } catch (e) {
    // ignore
  }
}

function requireOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) throw new HttpError(500, 'Server not configured: OPENAI_API_KEY is not set.')
}

const jobPaths = (ownerId, jobId) => {
  const dir = `${ownerId}/jobs`
  return {
    dir,
    pending: `${dir}/${jobId}.pending.json`,
    result: `${dir}/${jobId}.result.json`,
    err: `${dir}/${jobId}.error.json`,
  }
}

async function readJsonFile(store, path) {
  try {
    const buf = await store.download(path)
    return buf ? JSON.parse(buf.toString('utf8')) : null
  } catch (e) {
    return null
  }
}

async function saveError(store, p, code, message) {
  try {
    await store.upload(p.err, JSON.stringify({ error: message, code, at: new Date().toISOString() }), 'application/json')
  } catch (e) {
    // ignore; the response still carries the message
  }
}

const stamp = (o) => Date.parse((o && (o.updated_at || o.created_at)) || '') || 0

// Best effort, bounded: drop day-old result/error files; cancel + delete stale (abandoned) OpenAI responses.
async function cleanup(store, ownerId) {
  try {
    const dir = `${ownerId}/jobs`
    const listing = await store.list(dir, '')
    const now = Date.now()
    const old = listing.filter((o) => o && o.name && now - stamp(o) > KEEP_FILES_MS && /\.(result|error)\.json$/.test(o.name))
    const stale = listing
      .filter((o) => o && o.name && /\.pending\.json$/.test(o.name) && now - stamp(o) > MAX_JOB_MS)
      .slice(0, 3)
    await Promise.all(
      stale.map(async (o) => {
        const pending = await readJsonFile(store, `${dir}/${o.name}`)
        const id = pending && pending.responseId
        if (typeof id === 'string' && RESPONSE_ID_RE.test(id)) {
          await cancelResponse(id)
          await deleteResponse(id)
        }
      })
    )
    const remove = old.concat(stale).map((o) => `${dir}/${o.name}`)
    if (remove.length) await store.remove(remove)
  } catch (e) {
    // never block a start on cleanup
  }
}

// ---------------------------------------------------------------- response parsing

/** Concatenated output_text of the response; { refusal } if the model refused. */
function outputOf(resp) {
  let text = ''
  let refusal = ''
  for (const item of (resp && resp.output) || []) {
    if (!item || item.type !== 'message') continue
    for (const c of item.content || []) {
      if (c && c.type === 'refusal' && c.refusal) refusal += String(c.refusal)
      else if (c && typeof c.text === 'string') text += c.text
    }
  }
  if (!text && resp && typeof resp.output_text === 'string') text = resp.output_text
  return { text, refusal }
}

/** Parses JSON from model text (tolerates ``` fences / leading prose). Returns null if impossible. */
function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch (e) {
    const s = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (s >= 0 && end > s) {
      try {
        return JSON.parse(t.slice(s, end + 1))
      } catch (e2) {
        return null
      }
    }
    return null
  }
}

function failureOf(resp) {
  const err = (resp && resp.error) || {}
  const code = String(err.code || '')
  const msg = typeof err.message === 'string' ? err.message.slice(0, 200) : ''
  if (/moderation|safety|content_policy/i.test(code) || /safety|moderation|content policy/i.test(msg)) {
    return { code: 'moderation_blocked', message: SAFETY_MSG }
  }
  if (/insufficient_quota/i.test(code) || /quota|billing/i.test(msg)) {
    return { code: 'insufficient_quota', message: 'Your OpenAI account is out of credits (insufficient quota). Add billing on platform.openai.com, then try again.' }
  }
  if (/rate_limit/i.test(code)) return { code, message: 'OpenAI rate limit reached. Wait a minute and try again.' }
  if (resp && resp.status === 'incomplete') {
    const reason = resp.incomplete_details && resp.incomplete_details.reason
    if (reason === 'content_filter') return { code: 'moderation_blocked', message: SAFETY_MSG }
    return { code: 'incomplete', message: `The stylist stopped early${reason ? ` (${reason})` : ''}. Please try again.` }
  }
  if (resp && resp.status === 'cancelled') return { code: 'cancelled', message: 'The request was cancelled. Please try again.' }
  return { code: code || 'failed', message: `The AI request failed${msg ? `: ${msg}` : '.'}` }
}

// ---------------------------------------------------------------- start / status

/**
 * jobTypes: { [type]: { prepare(session, params) → { request, ctx, params }, finish(session, job, parsed) → result } }
 * request = { instructions, input, text?, max_output_tokens? } (model/background/store/reasoning are added here).
 */
async function startJob(session, body, jobTypes) {
  const type = typeof body.type === 'string' ? body.type : ''
  const handler = jobTypes[type]
  if (!handler) throw new HttpError(400, `type must be one of: ${Object.keys(jobTypes).join(', ')}.`)
  const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {}
  requireOpenAIKey()

  const ownerId = session.ownerId || session.user.id // shared wardrobe: always the owner's folder
  const store = storageClient(session)
  const cleaning = cleanup(store, ownerId)

  const prepared = await handler.prepare(session, params)
  const model = stylistModel()
  const request = {
    model,
    background: true,
    store: true, // keeps the response pollable beyond ~10 min; DELETEd as soon as we read the result
    ...prepared.request,
  }
  const reasoning = reasoningFor(model)
  if (reasoning) request.reasoning = reasoning

  const res = await openai('POST', '', request)
  if (!res.ok) {
    const mapped = mapOpenAIError(res.status, await readJson(res), model)
    console.error(`[wardrobe] openai create response (${type}) -> ${res.status} (${mapped.code})`)
    await cleaning
    throw new JobError(mapped.status, mapped.code, mapped.message)
  }
  const created = await readJson(res)
  if (!created || typeof created.id !== 'string' || !RESPONSE_ID_RE.test(created.id)) {
    await cleaning
    throw new JobError(502, 'empty', 'OpenAI did not accept the request. Please try again.')
  }

  const jobId = newJobId()
  const p = jobPaths(ownerId, jobId)
  try {
    await store.upload(
      p.pending,
      JSON.stringify({ responseId: created.id, type, params: prepared.params || {}, ctx: prepared.ctx || {}, startedAt: new Date().toISOString() }),
      'application/json'
    )
  } catch (e) {
    await cancelResponse(created.id)
    await deleteResponse(created.id)
    await cleaning
    throw e
  }
  await cleaning
  return { jobId, type, status: 'pending' }
}

async function statusJob(session, body, jobTypes) {
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim().toLowerCase() : ''
  if (!JOB_ID_RE.test(jobId)) throw new HttpError(400, 'Invalid job id.')
  requireOpenAIKey()
  const ownerId = session.ownerId || session.user.id
  const store = storageClient(session)
  const p = jobPaths(ownerId, jobId)

  const finished = async () => {
    const done = await readJsonFile(store, p.result)
    if (done) return { status: 'done', jobId, type: done.type, result: done.result }
    const err = await readJsonFile(store, p.err)
    if (err) return { status: 'error', jobId, error: err.error || 'The AI request failed.' }
    return null
  }

  const pending = await readJsonFile(store, p.pending)
  if (!pending) {
    return (await finished()) || { status: 'error', jobId, error: "This request wasn't found or has expired. Please try again." }
  }
  const responseId = typeof pending.responseId === 'string' ? pending.responseId : ''
  const handler = jobTypes[pending.type]
  const fail = async (code, message, { cancel = false } = {}) => {
    console.error(`[wardrobe] job ${pending.type || '?'} failed (${code})`)
    await saveError(store, p, code, message)
    await store.remove([p.pending])
    if (RESPONSE_ID_RE.test(responseId)) {
      if (cancel) await cancelResponse(responseId)
      await deleteResponse(responseId)
    }
    return { status: 'error', jobId, error: message }
  }
  if (!RESPONSE_ID_RE.test(responseId) || !handler) return fail('corrupt', 'This request is broken. Please try again.')

  const res = await openai('GET', `/${encodeURIComponent(responseId)}`)
  if (res.status === 404) {
    // Another poll already finished (and deleted) it, or it expired.
    const again = await finished()
    if (again) {
      await store.remove([p.pending])
      return again
    }
    return fail('expired', 'This request expired. Please try again.')
  }
  if (!res.ok) {
    const mapped = mapOpenAIError(res.status, await readJson(res), stylistModel())
    console.error(`[wardrobe] openai get response -> ${res.status} (${mapped.code})`)
    if (res.status === 429 || res.status >= 500) return { status: 'pending', jobId } // transient; keep polling
    throw new JobError(mapped.status, mapped.code, mapped.message)
  }
  const resp = await readJson(res)
  if (!resp) return { status: 'pending', jobId }

  if (resp.status === 'queued' || resp.status === 'in_progress') {
    const age = Date.now() - (Date.parse(pending.startedAt || '') || Date.now())
    if (age > MAX_JOB_MS) return fail('timeout', 'The stylist took too long (over 15 minutes). Please try again.', { cancel: true })
    return { status: 'pending', jobId }
  }
  if (resp.status !== 'completed') {
    const f = failureOf(resp)
    return fail(f.code, f.message)
  }

  const { text, refusal } = outputOf(resp)
  if (refusal && !text) return fail('refusal', `The AI declined this request: ${refusal.slice(0, 160)}`)
  const parsed = parseJson(text)
  if (!parsed) return fail('bad_output', 'The stylist sent an unreadable answer. Please try again.')

  let result
  try {
    result = await handler.finish(session, pending, parsed)
  } catch (e) {
    const message = e && e.statusCode ? e.message : 'Could not use the AI answer. Please try again.'
    return fail((e && e.code) || 'finish_failed', message)
  }
  try {
    await store.upload(p.result, JSON.stringify({ type: pending.type, result, finishedAt: new Date().toISOString() }), 'application/json')
  } catch (e) {
    // the caller still gets the result now; a second poll would report "expired"
  }
  await store.remove([p.pending, p.err])
  await deleteResponse(responseId)
  return { status: 'done', jobId, type: pending.type, result }
}

module.exports = {
  startJob,
  statusJob,
  stylistModel,
  reasoningFor,
  mapOpenAIError,
  parseJson,
  outputOf,
  JobError,
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
  JOB_ID_RE,
}
