// Minimal Anthropic Messages API client (raw fetch, no SDK).
const { HttpError } = require('./http')

const MODEL = 'claude-sonnet-5-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

// content: string or array of content blocks (text / image).
// Returns the concatenated text of the response's text blocks.
async function callClaude({ system, content, maxTokens = 4000, effort = 'low' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new HttpError(500, 'Server not configured: ANTHROPIC_API_KEY is not set.')

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    // Sonnet 5.5 runs adaptive thinking by default; low effort keeps it fast/cheap.
    output_config: { effort },
    // Server-side refusal fallback (Claude API only).
    fallbacks: 'default',
    messages: [{ role: 'user', content }],
  }
  if (system) body.system = system

  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new HttpError(502, 'Could not reach the AI service.')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err && err.error && err.error.type ? ` (${err.error.type})` : ''
    } catch (e) {
      // ignore
    }
    if (res.status === 429 || res.status === 529) {
      throw new HttpError(503, 'AI service is busy. Please try again in a minute.')
    }
    console.error(`[wardrobe] anthropic status ${res.status}${detail}`)
    throw new HttpError(502, `AI request failed${detail}.`)
  }

  const data = await res.json()
  if (data.stop_reason === 'refusal') {
    throw new HttpError(422, 'The AI declined this request. Try a different photo or note.')
  }
  const text = (data.content || [])
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
  if (!text.trim()) {
    throw new HttpError(502, 'AI returned an empty response. Please try again.')
  }
  return text
}

// Robustly extracts a JSON object from model text (handles code fences / prose).
function extractJson(text) {
  if (typeof text !== 'string') throw new HttpError(502, 'AI returned an unreadable response.')
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(s)
  } catch (e) {
    // fall through
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1))
    } catch (e) {
      // fall through
    }
  }
  throw new HttpError(502, 'AI returned an unreadable response. Please try again.')
}

module.exports = { callClaude, extractJson, MODEL }
