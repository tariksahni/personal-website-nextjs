// Minimal Supabase Storage REST client that acts AS THE USER (their bearer token),
// so the bucket's RLS policies apply. No dependencies. Never logs tokens or file data.
const { HttpError } = require('./http')

function storageClient({ supabaseUrl, anonKey, token, bucket = 'wardrobe' }) {
  const base = `${supabaseUrl}/storage/v1`
  const auth = { apikey: anonKey, Authorization: `Bearer ${token}` }
  const enc = (path) => path.split('/').map(encodeURIComponent).join('/')

  async function request(url, init, what) {
    try {
      return await fetch(url, init)
    } catch (e) {
      throw new HttpError(502, `Could not reach storage (${what}).`)
    }
  }

  return {
    /** Returns a Buffer, or null if the object does not exist. */
    async download(path) {
      const res = await request(`${base}/object/authenticated/${bucket}/${enc(path)}`, { headers: auth }, 'download')
      if (res.status === 404 || res.status === 400) return null
      if (!res.ok) {
        console.error(`[wardrobe] storage download -> ${res.status}`)
        throw new HttpError(502, 'Could not read a photo from storage.')
      }
      return Buffer.from(await res.arrayBuffer())
    },

    /** Upload (upsert) bytes to path. */
    async upload(path, data, contentType) {
      const res = await request(
        `${base}/object/${bucket}/${enc(path)}`,
        {
          method: 'POST',
          headers: { ...auth, 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': 'max-age=60' },
          body: data,
        },
        'upload'
      )
      if (!res.ok) {
        console.error(`[wardrobe] storage upload -> ${res.status}`)
        throw new HttpError(502, 'Could not save to storage.')
      }
    },

    /** Best-effort delete of several paths. Never throws. */
    async remove(paths) {
      try {
        const res = await fetch(`${base}/object/${bucket}`, {
          method: 'DELETE',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: paths }),
        })
        if (!res.ok) console.error(`[wardrobe] storage remove -> ${res.status}`)
      } catch (e) {
        console.error('[wardrobe] storage remove failed')
      }
    },

    /**
     * Signed (time-limited, publicly fetchable) URLs for several objects, as the user (RLS applies).
     * POST /storage/v1/object/sign/{bucket} { expiresIn, paths } → [{ path, signedURL, error }].
     * Returns { [path]: absoluteUrl }; paths that fail are missing. Never throws.
     */
    async signUrls(paths, expiresIn = 3600) {
      const out = {}
      if (!paths || !paths.length) return out
      try {
        const res = await fetch(`${base}/object/sign/${bucket}`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn, paths }),
        })
        if (!res.ok) {
          console.error(`[wardrobe] storage sign -> ${res.status}`)
          return out
        }
        const data = await res.json()
        for (const row of Array.isArray(data) ? data : []) {
          const rel = row && (row.signedURL || row.signedUrl)
          if (!rel || row.error || !row.path) continue
          out[row.path] = /^https?:\/\//.test(rel) ? rel : `${base}${rel.startsWith('/') ? '' : '/'}${rel}`
        }
      } catch (e) {
        console.error('[wardrobe] storage sign failed')
      }
      return out
    },

    /** Lists objects in a folder whose name matches `search`. Returns [] on error. */
    async list(prefix, search) {
      try {
        const res = await fetch(`${base}/object/list/${bucket}`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, search: search || '', limit: 100, offset: 0 }),
        })
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data) ? data : []
      } catch (e) {
        return []
      }
    },
  }
}

module.exports = { storageClient }
