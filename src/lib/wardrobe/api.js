// Calls the wardrobe Netlify Functions with the current Supabase session token.
import { supabase } from 'Lib/supabase'

const DEFAULT_TIMEOUT_MS = 45000

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function messageFor(status, serverMessage) {
  if (status === 401) return serverMessage || 'Your session has expired. Please sign in again.'
  if (status === 403) return serverMessage || 'This wardrobe is private.'
  if (status === 404) {
    return 'Wardrobe service not found. The Netlify functions are not running here (use `netlify dev` locally).'
  }
  if (status === 413) return serverMessage || 'That image is too large. Please try a smaller one.'
  if (status === 422) return serverMessage || "Couldn't process that request."
  if (status === 502 || status === 504) {
    return serverMessage || 'The stylist took too long to answer. Please try again.'
  }
  if (status >= 500) return serverMessage || 'Something went wrong on the server. Please try again.'
  return serverMessage || `Request failed (${status}).`
}

/**
 * POST JSON to /.netlify/functions/<name> with `Authorization: Bearer <access_token>`.
 * Resolves with the parsed JSON body; throws ApiError with a readable message.
 */
export async function callFn(name, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data && data.session ? data.session.access_token : null
  if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401)

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  let res
  try {
    res = await fetch(`/.netlify/functions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
      signal: controller ? controller.signal : undefined,
    })
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new ApiError('This is taking too long. Please check your connection and try again.', 0)
    }
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0)
  } finally {
    if (timer) clearTimeout(timer)
  }

  let json = null
  try {
    json = await res.json()
  } catch (e) {
    json = null
  }

  if (!res.ok) {
    const serverMessage = json && typeof json.error === 'string' ? json.error : null
    throw new ApiError(messageFor(res.status, serverMessage), res.status)
  }
  if (!json) throw new ApiError('The server sent an unexpected response.', res.status)
  return json
}

/** Today's date in the device's timezone as YYYY-MM-DD. */
export function localDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
