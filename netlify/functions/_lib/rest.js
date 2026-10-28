// Minimal Supabase PostgREST client that acts AS THE USER (their bearer token), so RLS applies.
// Never logs tokens, bodies or query values (only the table name + status).
const { HttpError } = require('./http')

function restClient({ supabaseUrl, anonKey, token }) {
  const base = `${supabaseUrl}/rest/v1`
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const table = (path) => path.split('?')[0]

  return {
    async get(path) {
      let res
      try {
        res = await fetch(`${base}/${path}`, { headers })
      } catch (e) {
        throw new HttpError(502, 'Could not reach the database.')
      }
      if (!res.ok) {
        console.error(`[wardrobe] rest GET ${table(path)} -> ${res.status}`)
        throw new HttpError(502, 'Could not load your wardrobe. Has the database migration been run?')
      }
      return res.json()
    },

    /** Upsert one row; returns true on success (never throws). */
    async upsert(tableName, row, onConflict) {
      try {
        const res = await fetch(`${base}/${tableName}?on_conflict=${onConflict}`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(row),
        })
        if (!res.ok) console.error(`[wardrobe] rest upsert ${tableName} -> ${res.status}`)
        return res.ok
      } catch (e) {
        console.error(`[wardrobe] rest upsert ${tableName} failed`)
        return false
      }
    },

    /** PATCH rows matching `filter` (e.g. "id=eq.<uuid>"); returns the updated rows. */
    async patch(tableName, filter, patch) {
      let res
      try {
        res = await fetch(`${base}/${tableName}?${filter}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(patch),
        })
      } catch (e) {
        throw new HttpError(502, 'Could not reach the database.')
      }
      if (!res.ok) {
        console.error(`[wardrobe] rest PATCH ${tableName} -> ${res.status}`)
        throw new HttpError(502, 'Could not save the new tags.')
      }
      return res.json()
    },
  }
}

module.exports = { restClient }
