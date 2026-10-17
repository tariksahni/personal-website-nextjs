// Verifies the caller's Supabase session and restricts access to the owner.
const { HttpError } = require('./http')

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !anonKey) {
    throw new HttpError(500, 'Server not configured: missing Supabase URL or anon key.')
  }
  return { url, anonKey }
}

function getBearerToken(event) {
  const headers = event.headers || {}
  const header = headers.authorization || headers.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

function maskEmail(email) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return 'an account without an email'
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

// WARDROBE_OWNER_EMAIL may hold one or more emails separated by commas/whitespace
// (surrounding quotes tolerated). Returns a lower-cased list.
function allowedEmails(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase())
    .filter(Boolean)
}

// The wardrobe this user acts on: public.wardrobe_owner() (supabase/005-wardrobe-shared.sql)
// maps a linked member account to the owner's id. Before 005 is run (RPC missing) → user.id.
async function resolveOwnerId({ url, anonKey, token, userId }) {
  let res
  try {
    res = await fetch(`${url}/rest/v1/rpc/wardrobe_owner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch (e) {
    throw new HttpError(502, 'Could not reach the database.')
  }
  if (res.ok) {
    let id = null
    try {
      id = await res.json()
    } catch (e) {
      id = null
    }
    if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) return id.toLowerCase()
    return userId
  }
  let code = ''
  try {
    const body = await res.json()
    code = (body && body.code) || ''
  } catch (e) {
    code = ''
  }
  if (res.status === 404 || code === 'PGRST202' || code === '42883') return userId
  console.error(`[wardrobe] wardrobe_owner rpc -> ${res.status}`)
  throw new HttpError(502, 'Could not resolve your wardrobe.')
}

// Returns { user, ownerId, token, supabaseUrl, anonKey } or throws HttpError.
// ownerId is the wardrobe owner's user id: use it (never user.id) for storage paths and user_id values.
async function requireOwner(event) {
  const token = getBearerToken(event)
  if (!token) throw new HttpError(401, 'Not signed in.')

  const owners = allowedEmails(process.env.WARDROBE_OWNER_EMAIL)
  const { url, anonKey } = supabaseConfig()

  let res
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
  } catch (e) {
    throw new HttpError(502, 'Could not reach the auth server.')
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'Session expired. Please sign in again.')
  }
  if (!res.ok) throw new HttpError(502, 'Auth check failed.')

  const user = await res.json()
  if (!user || !user.id) throw new HttpError(401, 'Session expired. Please sign in again.')

  // Deny everyone if the owner isn't configured (avoids spending API credits for strangers).
  if (!owners.length) throw new HttpError(500, 'Server not configured: WARDROBE_OWNER_EMAIL is not set.')
  const email = (user.email || '').trim().toLowerCase()
  if (!email || !owners.includes(email)) {
    // Shown only to the signed-in user: their own (masked) email, so a mismatch is easy to spot.
    throw new HttpError(
      403,
      `This wardrobe is private. You're signed in as ${maskEmail(email)}, which doesn't match WARDROBE_OWNER_EMAIL in Netlify.`
    )
  }

  const ownerId = await resolveOwnerId({ url, anonKey, token, userId: user.id })
  return { user, ownerId, token, supabaseUrl: url, anonKey }
}

module.exports = { requireOwner, getBearerToken, supabaseConfig, _allowedEmails: allowedEmails }
