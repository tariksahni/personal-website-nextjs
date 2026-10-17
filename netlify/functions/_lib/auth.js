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

// Returns { user, token, supabaseUrl, anonKey } or throws HttpError.
async function requireOwner(event) {
  const token = getBearerToken(event)
  if (!token) throw new HttpError(401, 'Not signed in.')

  const ownerEmail = (process.env.WARDROBE_OWNER_EMAIL || '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
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
  if (!ownerEmail) throw new HttpError(500, 'Server not configured: WARDROBE_OWNER_EMAIL is not set.')
  const email = (user.email || '').trim().toLowerCase()
  if (email !== ownerEmail) {
    // Shown only to the signed-in user: their own (masked) email, so a mismatch is easy to spot.
    throw new HttpError(
      403,
      `This wardrobe is private. You're signed in as ${maskEmail(email)}, which doesn't match WARDROBE_OWNER_EMAIL in Netlify.`
    )
  }

  return { user, token, supabaseUrl: url, anonKey }
}

module.exports = { requireOwner, getBearerToken, supabaseConfig }
