// Provider-agnostic AI client used by the wardrobe functions.
//
// Provider selection:
//   AI_PROVIDER=openai|anthropic forces a provider (its key must be set).
//   Otherwise: OPENAI_API_KEY set -> OpenAI; else ANTHROPIC_API_KEY set -> Anthropic; else 500.
//
// Neutral content format accepted by callModel:
//   content: string | Array<{ type: 'text', text } | { type: 'image', mediaType, data /* base64, no prefix */ }>
const { HttpError } = require('./http')
const anthropic = require('./anthropic')

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

function pickProvider() {
  const forced = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (forced) {
    if (forced === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new HttpError(500, 'Server not configured: AI_PROVIDER=openai but OPENAI_API_KEY is not set.')
      return 'openai'
    }
    if (forced === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(500, 'Server not configured: AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.')
      return 'anthropic'
    }
    throw new HttpError(500, 'Server not configured: AI_PROVIDER must be "openai" or "anthropic".')
  }
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  throw new HttpError(500, 'No AI key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY).')
}

function toParts(content) {
  return typeof content === 'string' ? [{ type: 'text', text: content }] : content || []
}

// ---------- Anthropic mapping ----------
function toAnthropicContent(content) {
  if (typeof content === 'string') return content
  return toParts(content).map((p) =>
    p.type === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } }
      : { type: 'text', text: p.text }
  )
}

// ---------- OpenAI ----------
function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  return toParts(content).map((p) =>
    p.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } }
      : { type: 'text', text: p.text }
  )
}

function mentionsJson(system, content) {
  const texts = [system || ''].concat(toParts(content).filter((p) => p.type === 'text').map((p) => p.text))
  return texts.some((t) => /json/i.test(t))
}

async function callOpenAI({ system, content, maxTokens, json }) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = (process.env.OPENAI_MODEL || '').trim() || OPENAI_DEFAULT_MODEL

  let sys = system || ''
  // OpenAI's json_object mode requires the word "JSON" somewhere in the messages.
  if (json && !mentionsJson(sys, content)) sys = `${sys}${sys ? '\n' : ''}Respond with a JSON object only.`

  const messages = []
  if (sys) messages.push({ role: 'system', content: sys })
  messages.push({ role: 'user', content: toOpenAIContent(content) })

  const body = { model, messages, max_completion_tokens: maxTokens }
  if (json) body.response_format = { type: 'json_object' }

  let res
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new HttpError(502, 'Could not reach the AI service.')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      const code = err && err.error && (err.error.code || err.error.type)
      detail = code ? ` (${String(code).slice(0, 60)})` : ''
    } catch (e) {
      // ignore
    }
    if (res.status === 429 || res.status === 503) {
      throw new HttpError(503, 'AI service is busy. Please try again in a minute.')
    }
    console.error(`[wardrobe] openai status ${res.status}${detail}`)
    throw new HttpError(502, `AI request failed${detail}.`)
  }

  const data = await res.json()
  const choice = (data.choices || [])[0] || {}
  const msg = choice.message || {}
  if (msg.refusal || choice.finish_reason === 'content_filter') {
    throw new HttpError(422, 'The AI declined this request. Try a different photo or note.')
  }
  const text = typeof msg.content === 'string' ? msg.content : ''
  if (!text.trim()) {
    throw new HttpError(502, 'AI returned an empty response. Please try again.')
  }
  return text
}

// ---------- Public API ----------
// Returns the model's text. `json: true` asks the provider for JSON output where supported.
// `effort` only applies to Anthropic.
async function callModel({ system, content, maxTokens = 4000, effort = 'low', json = false }) {
  const provider = pickProvider()
  if (provider === 'openai') return callOpenAI({ system, content, maxTokens, json })
  return anthropic.callClaude({ system, content: toAnthropicContent(content), maxTokens, effort })
}

module.exports = { callModel, extractJson: anthropic.extractJson, pickProvider, OPENAI_DEFAULT_MODEL }
