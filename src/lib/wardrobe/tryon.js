// Virtual try-on (client side). Storage layout in the private "wardrobe" bucket ({uid} = getOwnerId()):
//   {uid}/me/photo.jpg                owner Photo 1
//   {uid}/me/photo2.jpg               owner Photo 2 (optional)
//   {uid}/tryons/{key}.png            generated look
//   {uid}/tryons/{key}.error.json     last failure message
//   {uid}/tryons/{key}.pending.json   generation in progress
// key must match netlify/functions/_lib/tryon.js → tryOnKey(). Photo 2 keys end in "-p2".
// (Photo 1 keys are the plain hash, so looks created before Photo 2 existed still resolve.)
import { supabase } from 'Lib/supabase'
import { callFn, ApiError } from './api'
import { BUCKET, getOwnerId } from './data'

const PHOTO_FILES = { 1: 'photo.jpg', 2: 'photo2.jpg' }
export const PHOTO_SLOTS = [1, 2]
const URL_TTL = 3600
const POLL_MS = 4000
const POLL_MAX_MS = 5 * 60 * 1000 // high quality can take a few minutes
const PENDING_STALE_MS = 10 * 60 * 1000

function bucket() {
  return supabase.storage.from(BUCKET)
}

function fail(error, fallback) {
  const msg = (error && error.message) || fallback
  return new Error(/bucket not found/i.test(msg) ? 'Wardrobe storage is not set up yet. Run supabase/004-wardrobe.sql.' : msg)
}

async function signedUrl(path) {
  const { data, error } = await bucket().createSignedUrl(path, URL_TTL)
  if (error || !data) throw fail(error, 'Could not load the image.')
  return data.signedUrl
}

function slotOf(photo) {
  return Number(photo) === 2 ? 2 : 1
}

/**
 * Stable key for a set of item ids + owner photo: first 32 hex chars of
 * sha256(sorted unique ids joined by ","), plus "-p2" for Photo 2.
 */
export async function tryOnKey(itemIds, photo = 1) {
  const ids = Array.from(new Set((itemIds || []).map((x) => String(x).trim().toLowerCase()))).sort()
  const bytes = new TextEncoder().encode(ids.join(','))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
  return slotOf(photo) === 2 ? `${hex}-p2` : hex
}

/** Which owner photo a look key was made from (1 | 2). */
export function photoOfKey(key) {
  return /-p2$/.test(key || '') ? 2 : 1
}

// ---------------------------------------------------------------- owner photo

/** Both owner photos: { 1: { path, url, updatedAt } | null, 2: ... }. */
export async function getOwnerPhotos() {
  const uid = await getOwnerId()
  const { data, error } = await bucket().list(`${uid}/me`, { search: 'photo', limit: 20 })
  if (error) throw fail(error, 'Could not check your photos.')
  const out = { 1: null, 2: null }
  await Promise.all(
    PHOTO_SLOTS.map(async (slot) => {
      const obj = (data || []).find((o) => o.name === PHOTO_FILES[slot])
      if (!obj) return
      const path = `${uid}/me/${PHOTO_FILES[slot]}`
      out[slot] = { slot, path, url: await signedUrl(path), updatedAt: obj.updated_at || obj.created_at || null }
    })
  )
  return out
}

/** Returns { path, url, updatedAt } or null if that photo slot is empty. */
export async function getOwnerPhoto(photo = 1) {
  return (await getOwnerPhotos())[slotOf(photo)]
}

export async function uploadOwnerPhoto(blob, photo = 1) {
  const slot = slotOf(photo)
  const uid = await getOwnerId()
  const path = `${uid}/me/${PHOTO_FILES[slot]}`
  const { error } = await bucket().upload(path, blob, { contentType: 'image/jpeg', cacheControl: '60', upsert: true })
  if (error) throw fail(error, 'Could not save your photo.')
  return { slot, path, url: await signedUrl(path), updatedAt: new Date().toISOString() }
}

export async function deleteOwnerPhoto(photo = 1) {
  const uid = await getOwnerId()
  const { error } = await bucket().remove([`${uid}/me/${PHOTO_FILES[slotOf(photo)]}`])
  if (error) throw fail(error, 'Could not delete your photo.')
}

// ---------------------------------------------------------------- looks

/** Status of one look: { png, error, pending } (storage objects or null). */
async function lookStatus(uid, key) {
  const { data, error } = await bucket().list(`${uid}/tryons`, { search: key, limit: 10 })
  if (error) throw fail(error, 'Could not check the look.')
  const find = (suffix) => (data || []).find((o) => o.name === `${key}${suffix}`) || null
  return { png: find('.png'), error: find('.error.json'), pending: find('.pending.json') }
}

const stamp = (o) => (o ? o.updated_at || o.created_at || '' : '')

/** Cached look for these items + photo slot. Also reports an in-flight generation (pending). */
export async function findLook(itemIds, photo = 1) {
  const uid = await getOwnerId()
  const slot = slotOf(photo)
  const key = await tryOnKey(itemIds, slot)
  const s = await lookStatus(uid, key)
  const pendingFresh = !!s.pending && Date.now() - Date.parse(stamp(s.pending)) < PENDING_STALE_MS
  if (s.png) {
    const path = `${uid}/tryons/${key}.png`
    return { key, photo: slot, path, url: await signedUrl(path), updatedAt: stamp(s.png), pending: pendingFresh }
  }
  return { key, photo: slot, path: null, url: null, pending: pendingFresh }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Polls wardrobe-tryon-status every 4s (up to ~5 min) until the look is done or failed. */
async function pollStatus(key, isCancelled) {
  const uid = await getOwnerId()
  const deadline = Date.now() + POLL_MAX_MS
  let transientErrors = 0
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    if (isCancelled && isCancelled()) return null
    let res
    try {
      res = await callFn('wardrobe-tryon-status', { key }, { timeoutMs: 20000 })
      transientErrors = 0
    } catch (e) {
      // Network blips / gateway timeouts: keep polling a few times before giving up.
      if (e instanceof ApiError && (e.status === 0 || e.status >= 502) && transientErrors < 3) {
        transientErrors += 1
        continue
      }
      throw e
    }
    if (res.status === 'done') {
      const path = `${uid}/tryons/${key}.png`
      return { key, photo: photoOfKey(key), path, url: await signedUrl(path), updatedAt: new Date().toISOString() }
    }
    if (res.status === 'error') throw new Error(res.error || 'Generating the look failed.')
    if (res.status === 'none') throw new Error('The generation was lost. Please try again.')
  }
  throw new Error('Still not ready after 5 minutes. Check "My looks" in the Me tab later, or try again.')
}

/**
 * Starts a try-on via wardrobe-tryon-start (OpenAI background response), then polls
 * wardrobe-tryon-status. With resumeOnly it just resumes polling an in-flight generation.
 */
export async function generateLook({ itemIds, outfitName, photo = 1, isCancelled, resumeOnly = false }) {
  const slot = slotOf(photo)
  const key = await tryOnKey(itemIds, slot)
  if (!resumeOnly) {
    await callFn('wardrobe-tryon-start', { itemIds, outfitName, key, photo: slot }, { timeoutMs: 30000 })
  }
  return pollStatus(key, isCancelled)
}

// TEMP: test image button — remove after dashboard check
export async function generateTestImage({ isCancelled } = {}) {
  const res = await callFn('wardrobe-tryon-start', { mode: 'test' }, { timeoutMs: 30000 })
  return pollStatus(res.key, isCancelled)
}

/** All saved looks (both photo slots), newest first: [{ key, photo, path, url, updatedAt }]. */
export async function listLooks() {
  const uid = await getOwnerId()
  const { data, error } = await bucket().list(`${uid}/tryons`, {
    limit: 200,
    sortBy: { column: 'updated_at', order: 'desc' },
  })
  if (error) throw fail(error, 'Could not load your looks.')
  const pngs = (data || []).filter((o) => /\.png$/.test(o.name) && !/^test-/.test(o.name))
  if (pngs.length === 0) return []
  const paths = pngs.map((o) => `${uid}/tryons/${o.name}`)
  const { data: urls, error: urlError } = await bucket().createSignedUrls(paths, URL_TTL)
  if (urlError) throw fail(urlError, 'Could not load your looks.')
  const byPath = {}
  ;(urls || []).forEach((u) => {
    if (u && u.signedUrl) byPath[u.path] = u.signedUrl
  })
  return pngs.map((o, i) => ({
    key: o.name.replace(/\.png$/, ''),
    photo: photoOfKey(o.name.replace(/\.png$/, '')),
    path: paths[i],
    url: byPath[paths[i]] || null,
    updatedAt: stamp(o),
  }))
}

export async function deleteLook(key) {
  const uid = await getOwnerId()
  const dir = `${uid}/tryons/${key}`
  const { error } = await bucket().remove([`${dir}.png`, `${dir}.error.json`, `${dir}.pending.json`])
  if (error) throw fail(error, 'Could not delete the look.')
}

/** Download or share a look image. Returns 'shared' | 'downloaded'. */
export async function saveOrShareLook(url, { share = false, name = 'my-look' } = {}) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch the image.')
  const blob = await res.blob()
  const file = typeof File !== 'undefined' ? new File([blob], `${name}.png`, { type: 'image/png' }) : null
  if (share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My look' })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
      throw new Error('Sharing failed.')
    }
  }
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `${name}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
  return 'downloaded'
}

export function canShareFiles() {
  if (typeof navigator === 'undefined' || !navigator.canShare || typeof File === 'undefined') return false
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })
  } catch (e) {
    return false
  }
}
