// Async AI jobs (netlify/functions/wardrobe-ai-start + wardrobe-ai-status).
// The server starts an OpenAI background response and returns a jobId; the client polls until done.
import { callFn, ApiError } from './api'

const DEFAULT_INTERVAL_MS = 3000
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const RESUME_PREFIX = 'wardrobe.job.'
const RESUME_MAX_AGE_MS = 15 * 60 * 1000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Starts a job. Resolves with the jobId. */
export async function startJob(type, params) {
  const res = await callFn('wardrobe-ai-start', { type, params }, { timeoutMs: 30000 })
  if (!res || !res.jobId) throw new Error('The stylist did not start. Please try again.')
  return res.jobId
}

/**
 * Polls a job until it finishes. Resolves with the job's `result`; rejects with a readable Error.
 * onTick({ elapsedMs }) is called after every poll. isCancelled() → stop quietly (resolves null).
 */
export async function pollJob(jobId, { intervalMs = DEFAULT_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, onTick, isCancelled } = {}) {
  const started = Date.now()
  let transient = 0
  while (Date.now() - started < timeoutMs) {
    await sleep(intervalMs)
    if (isCancelled && isCancelled()) return null
    let res
    try {
      res = await callFn('wardrobe-ai-status', { jobId }, { timeoutMs: 20000 })
      transient = 0
    } catch (e) {
      // Network blips / gateway timeouts: keep polling a few times before giving up.
      if (e instanceof ApiError && (e.status === 0 || e.status >= 502) && transient < 3) {
        transient += 1
        continue
      }
      throw e
    }
    if (onTick) onTick({ elapsedMs: Date.now() - started })
    if (res.status === 'done') return res.result
    if (res.status === 'error') throw new Error(res.error || 'The AI request failed. Please try again.')
  }
  throw new Error('The stylist is taking longer than 5 minutes. Please try again.')
}

/** startJob + pollJob. */
export async function runJob(type, params, opts = {}) {
  const jobId = await startJob(type, params)
  if (opts.onStart) opts.onStart(jobId)
  return pollJob(jobId, opts)
}

/** Runs `worker(item, index)` over `list` with at most `limit` in flight. Resolves when all settle. */
export async function mapLimit(list, limit, worker) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next
      next += 1
      // eslint-disable-next-line no-await-in-loop
      await worker(list[i], i)
    }
  })
  await Promise.all(runners)
}

// ---------------------------------------------------------------- resume after reload (best effort)

/** Remembers an in-flight job for this tab session under `slot` (e.g. "office", "request"). */
export function rememberJob(slot, jobId, meta) {
  try {
    window.sessionStorage.setItem(RESUME_PREFIX + slot, JSON.stringify({ jobId, meta: meta || null, at: Date.now() }))
  } catch (e) {
    // storage unavailable
  }
}

export function forgetJob(slot) {
  try {
    window.sessionStorage.removeItem(RESUME_PREFIX + slot)
  } catch (e) {
    // storage unavailable
  }
}

/** { jobId, meta, at } for a recent in-flight job in `slot`, or null. */
export function recallJob(slot) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RESUME_PREFIX + slot) || 'null')
    if (saved && saved.jobId && Date.now() - saved.at < RESUME_MAX_AGE_MS) return saved
  } catch (e) {
    // storage unavailable / bad JSON
  }
  forgetJob(slot)
  return null
}
