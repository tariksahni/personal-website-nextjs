// Direct Supabase access for the wardrobe app (browser, user session; RLS = owner's rows; see getOwnerId).
// Tables/bucket are defined in supabase/004-wardrobe.sql.
import { supabase } from 'Lib/supabase'

export const BUCKET = 'wardrobe'
export const CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessory']
export const FORMALITY = ['casual', 'smart_casual', 'formal']
export const SEASONS = ['spring', 'summer', 'autumn', 'winter']
export const OCCASIONS = ['office', 'casual', 'special']

const SIGNED_URL_TTL = 3600 // seconds
const SIGNED_URL_MARGIN_MS = 5 * 60 * 1000 // refresh 5 min before expiry

function friendly(error) {
  const msg = (error && error.message) || String(error || 'Unknown error')
  if (
    (error && error.code === '42P01') ||
    /relation .*wardrobe.* does not exist|could not find the table/i.test(msg) ||
    /bucket not found/i.test(msg)
  ) {
    return 'Wardrobe storage is not set up yet. Run supabase/004-wardrobe.sql in the Supabase SQL editor.'
  }
  if (/jwt expired|invalid jwt/i.test(msg)) return 'Your session has expired. Please sign in again.'
  if (/failed to fetch|network/i.test(msg)) return "Couldn't reach the database. Check your connection."
  return msg
}

function unwrap({ data, error }) {
  if (error) throw new Error(friendly(error))
  return data
}

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export async function getUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data && data.session && data.session.user ? data.session.user.id : null
  if (!id) throw new Error('Your session has expired. Please sign in again.')
  return id
}

// Shared wardrobe (supabase/005-wardrobe-shared.sql): a linked member account uses the owner's
// rows and "<owner_id>/..." storage folder. Cached per signed-in user; falls back to the session
// user id if the RPC is missing (005 not run) or errors (fallback is not cached).
let ownerCache = { userId: null, promise: null }

export function clearOwnerIdCache() {
  ownerCache = { userId: null, promise: null }
}

if (typeof window !== 'undefined' && supabase && supabase.auth && supabase.auth.onAuthStateChange) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const id = session && session.user ? session.user.id : null
    if (id !== ownerCache.userId) clearOwnerIdCache()
  })
}

export async function getOwnerId() {
  const userId = await getUserId()
  if (ownerCache.userId === userId && ownerCache.promise) return ownerCache.promise
  const promise = Promise.resolve()
    .then(() => supabase.rpc('wardrobe_owner'))
    .then(({ data, error }) => (!error && typeof data === 'string' && data ? data : userId))
    .catch(() => userId)
  ownerCache = { userId, promise }
  const ownerId = await promise
  if (ownerId === userId && ownerCache.promise === promise) ownerCache = { userId, promise: null }
  return ownerId
}

// ---------------------------------------------------------------- items

export async function listItems() {
  return unwrap(
    await supabase.from('wardrobe_items').select('*').order('created_at', { ascending: false })
  ) || []
}

/** Uploads a JPEG blob to wardrobe/{uid}/{uuid}.jpg and returns the object path. */
export async function uploadImage(blob) {
  const uid = await getOwnerId()
  const path = `${uid}/${uuid()}.jpg`
  unwrap(
    await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    })
  )
  return path
}

/** Downloads an object (used to re-tag an existing item). */
export async function downloadImage(path) {
  return unwrap(await supabase.storage.from(BUCKET).download(path))
}

const ITEM_FIELDS = ['category', 'subcategory', 'colors', 'pattern', 'formality', 'seasons', 'description']

function pickItemFields(src) {
  const out = {}
  ITEM_FIELDS.forEach((k) => {
    if (src && src[k] !== undefined) out[k] = src[k]
  })
  return out
}

/** Insert a closet item. `tags` may be null (tagging failed → "Needs tags"). */
export async function insertItem(imagePath, tags) {
  const uid = await getOwnerId()
  const row = {
    user_id: uid,
    image_path: imagePath,
    category: null,
    colors: [],
    seasons: [],
    ...pickItemFields(tags),
  }
  return unwrap(await supabase.from('wardrobe_items').insert(row).select().single())
}

export async function updateItem(id, patch) {
  return unwrap(
    await supabase.from('wardrobe_items').update(pickItemFields(patch)).eq('id', id).select().single()
  )
}

/** Deletes the row, then (best effort) the storage object. */
export async function deleteItem(item) {
  unwrap(await supabase.from('wardrobe_items').delete().eq('id', item.id))
  if (item.image_path) {
    signedUrlCache.delete(item.image_path)
    const { error } = await supabase.storage.from(BUCKET).remove([item.image_path])
    if (error && typeof console !== 'undefined') console.warn('[wardrobe] image cleanup failed')
  }
}

// ---------------------------------------------------------------- signed URLs

const signedUrlCache = new Map() // path -> { url, expiresAt }

/** Returns { [path]: signedUrl } for the given paths (1h URLs, cached in memory). */
export async function getSignedUrls(paths) {
  const now = Date.now()
  const unique = Array.from(new Set((paths || []).filter(Boolean)))
  const missing = unique.filter((p) => {
    const hit = signedUrlCache.get(p)
    return !hit || hit.expiresAt - SIGNED_URL_MARGIN_MS < now
  })

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100)
    const data = unwrap(await supabase.storage.from(BUCKET).createSignedUrls(batch, SIGNED_URL_TTL)) || []
    const expiresAt = Date.now() + SIGNED_URL_TTL * 1000
    data.forEach((entry) => {
      if (entry && entry.signedUrl && !entry.error) {
        signedUrlCache.set(entry.path, { url: entry.signedUrl, expiresAt })
      }
    })
  }

  const out = {}
  unique.forEach((p) => {
    const hit = signedUrlCache.get(p)
    if (hit) out[p] = hit.url
  })
  return out
}

// ---------------------------------------------------------------- profile

export async function getProfile() {
  return unwrap(await supabase.from('wardrobe_profile').select('*').maybeSingle())
}

export async function saveProfile({ profileText, notes }) {
  const uid = await getOwnerId()
  return unwrap(
    await supabase
      .from('wardrobe_profile')
      .upsert(
        {
          user_id: uid,
          profile_text: profileText || null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()
  )
}

// ---------------------------------------------------------------- wear log

export async function getWearLog(date) {
  return unwrap(await supabase.from('wardrobe_wear_log').select('*').eq('worn_on', date).maybeSingle())
}

/** One logged outfit per day: re-logging replaces today's entry. */
export async function logWear({ date, occasion, outfit }) {
  const uid = await getOwnerId()
  return unwrap(
    await supabase
      .from('wardrobe_wear_log')
      .upsert(
        {
          user_id: uid,
          worn_on: date,
          occasion: occasion || null,
          item_ids: outfit.item_ids,
          outfit: { name: outfit.name, reason: outfit.reason, item_ids: outfit.item_ids },
        },
        { onConflict: 'user_id,worn_on' }
      )
      .select()
      .single()
  )
}

// ---------------------------------------------------------------- cached suggestions

/** Returns { office?: payload, casual?: payload, special?: payload } cached for `date`. */
export async function getSuggestions(date) {
  const rows =
    unwrap(await supabase.from('wardrobe_suggestions').select('occasion, payload').eq('for_date', date)) || []
  const out = {}
  rows.forEach((r) => {
    if (r && r.occasion && r.payload) out[r.occasion] = r.payload
  })
  return out
}
