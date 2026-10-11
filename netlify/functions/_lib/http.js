// Small HTTP helpers shared by Netlify Functions. No dependencies.

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

function requirePost(event) {
  if (event.httpMethod !== 'POST') {
    throw new HttpError(405, 'Method not allowed. Use POST.')
  }
}

function parseBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed
  } catch (e) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }
}

// Wraps a handler: enforces POST, converts thrown errors to JSON responses.
// Never logs request bodies (they may contain images) or tokens.
function withHandler(fn) {
  return async (event, context) => {
    try {
      requirePost(event)
      const result = await fn(event, context)
      return json(200, result)
    } catch (err) {
      const status = err && err.statusCode ? err.statusCode : 500
      const message =
        err && err.statusCode ? err.message : 'Something went wrong. Please try again.'
      if (!err || !err.statusCode || status >= 500) {
        console.error('[wardrobe] error:', err && err.message ? err.message : String(err))
      }
      return json(status, { error: message })
    }
  }
}

module.exports = { HttpError, json, requirePost, parseBody, withHandler }
