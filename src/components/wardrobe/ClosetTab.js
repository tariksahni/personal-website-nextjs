import { useCallback, useRef, useState } from 'react'
import { resizeImage } from 'Lib/wardrobe/image'
import { callFn } from 'Lib/wardrobe/api'
import { uploadImage, insertItem, deleteItem, downloadImage, updateItem } from 'Lib/wardrobe/data'
import ItemCard from './ItemCard'
import ItemEditor from './ItemEditor'
import { BTN_PRIMARY, BTN_SECONDARY, BTN_BASE, Spinner, ErrorBanner } from './ui'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'outerwear', label: 'Jackets' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'untagged', label: 'Needs tags' },
]

const CLOSET_MAX_PX = 1536
const CLOSET_QUALITY = 0.85
const MAX_TAG_BASE64 = 4.5 * 1024 * 1024

/** Upload one photo: resize → storage → AI tags (optional) → row. Returns { item, tagError }. */
async function addOne(file, onStep) {
  onStep('Preparing photo')
  // Quality first: 1536px / 0.85 (base64 stays well under wardrobe-tag's 5MB limit).
  let { blob, base64, mediaType } = await resizeImage(file, CLOSET_MAX_PX, CLOSET_QUALITY)
  // Netlify sync functions accept ~6MB bodies: fall back to the smaller default for huge, noisy photos.
  if (base64.length > MAX_TAG_BASE64) ({ blob, base64, mediaType } = await resizeImage(file))
  onStep('Uploading')
  const path = await uploadImage(blob)
  onStep('Tagging')
  let tags = null
  let tagError = null
  try {
    const res = await callFn('wardrobe-tag', { imageBase64: base64, mediaType })
    tags = res.tags
  } catch (e) {
    tagError = e.message
  }
  onStep('Saving')
  const item = await insertItem(path, tags)
  return { item, tagError }
}

export default function ClosetTab({ items, urls, loading, onItemsChange }) {
  const [filter, setFilter] = useState('all')
  const [progress, setProgress] = useState(null) // { index, total, step }
  const [errors, setErrors] = useState([])
  const [editing, setEditing] = useState(null)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setErrors([])
    const problems = []
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      const label = files.length > 1 ? `Photo ${i + 1}` : 'Photo'
      setProgress({ index: i, total: files.length, step: 'Preparing photo' })
      try {
        // eslint-disable-next-line no-await-in-loop
        const { item, tagError } = await addOne(file, (step) =>
          setProgress({ index: i, total: files.length, step })
        )
        onItemsChange((prev) => [item, ...prev])
        if (tagError) problems.push(`${label}: added, but tagging failed (${tagError}). Tap it to tag manually.`)
      } catch (e) {
        problems.push(`${label}: ${e.message}`)
      }
    }
    setProgress(null)
    setErrors(problems)
  }

  // Re-run AI tagging on existing items (e.g. after tagging got more precise). Overwrites tags.
  const retagAll = async () => {
    const targets = visible
    if (!targets.length) return
    const ok = window.confirm(
      `Re-tag ${targets.length} item${targets.length === 1 ? '' : 's'} with AI? Your colours are kept; other tags (type, collar, pattern, formality, seasons, description) are replaced.`
    )
    if (!ok) return
    setErrors([])
    const problems = []
    for (let i = 0; i < targets.length; i += 1) {
      const it = targets[i]
      setProgress({ index: i, total: targets.length, step: 'Re-tagging', verb: 'Re-tagging' })
      try {
        // eslint-disable-next-line no-await-in-loop
        const blob = await downloadImage(it.image_path)
        // eslint-disable-next-line no-await-in-loop
        const { base64, mediaType } = await resizeImage(blob)
        // eslint-disable-next-line no-await-in-loop
        const { tags } = await callFn('wardrobe-tag', { imageBase64: base64, mediaType })
        // Keep the owner's colours (often fixed by hand); only fall back to AI colours if none are set.
        const { colors, ...rest } = tags || {}
        const patch = it.colors && it.colors.length ? rest : { ...rest, colors }
        // eslint-disable-next-line no-await-in-loop
        const updated = await updateItem(it.id, patch)
        onItemsChange((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      } catch (e) {
        problems.push(`${it.subcategory || 'Item'}: ${e.message}`)
      }
    }
    setProgress(null)
    setErrors(problems)
  }

  const onPick = (e) => {
    const files = e.target.files
    handleFiles(files)
    e.target.value = '' // allow re-picking the same file
  }

  const closeEditor = useCallback(() => setEditing(null), [])

  const counts = items.reduce(
    (acc, it) => {
      acc[it.category || 'untagged'] = (acc[it.category || 'untagged'] || 0) + 1
      return acc
    },
    { all: items.length }
  )
  // Fall back to "All" if the selected filter has become empty (e.g. last untagged item got tagged).
  const activeFilter = filter === 'all' || counts[filter] ? filter : 'all'
  const visible = items.filter((it) =>
    activeFilter === 'all' ? true : activeFilter === 'untagged' ? !it.category : it.category === activeFilter
  )
  const busy = !!progress

  return (
    <div className="tw-space-y-4">
      <input ref={galleryRef} type="file" accept="image/*" multiple onChange={onPick} className="tw-hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="tw-hidden" />

      <div className="tw-grid tw-grid-cols-2 tw-gap-3">
        <button type="button" disabled={busy} onClick={() => galleryRef.current && galleryRef.current.click()} className={BTN_PRIMARY}>
          <span aria-hidden className="tw-text-lg tw-leading-none">+</span> Add clothes
        </button>
        <button type="button" disabled={busy} onClick={() => cameraRef.current && cameraRef.current.click()} className={BTN_SECONDARY}>
          <svg aria-hidden className="tw-w-5 tw-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
          </svg>
          Camera
        </button>
      </div>

      {progress && (
        <div className="tw-rounded-2xl tw-border tw-border-solid tw-border-stone-200 tw-bg-white tw-p-4" aria-live="polite">
          <div className="tw-flex tw-items-center tw-gap-3">
            <Spinner />
            <p className="tw-flex-1 tw-text-sm tw-text-stone-700">
              {progress.total > 1 ? `${progress.verb || 'Adding'} ${progress.index + 1} of ${progress.total}` : progress.step}
              {progress.total > 1 && !progress.verb ? ` · ${progress.step}` : ''}…
            </p>
          </div>
          <div className="tw-mt-3 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-stone-100">
            <div
              className="tw-h-full tw-rounded-full tw-bg-stone-900 tw-transition-all tw-duration-500"
              style={{ width: `${Math.round(((progress.index + 0.5) / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {errors.length > 0 && <ErrorBanner message={errors.join('\n')} onDismiss={() => setErrors([])} />}

      {items.length > 0 && (
        <div className="-tw-mx-4 tw-overflow-x-auto tw-px-4 tw-pb-1" style={{ scrollbarWidth: 'none' }}>
          <div className="tw-flex tw-gap-2 tw-w-max">
            {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => {
              const on = activeFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={on}
                  className={`${BTN_BASE} tw-min-h-[36px] tw-px-3.5 tw-rounded-full tw-text-sm tw-border tw-border-solid ${
                    on
                      ? 'tw-border-stone-900 focus:tw-border-stone-900 tw-bg-stone-900 active:tw-bg-stone-800 tw-text-white'
                      : f.id === 'untagged'
                        ? 'tw-border-amber-300 focus:tw-border-amber-300 tw-bg-amber-50 active:tw-bg-amber-100 tw-text-amber-900'
                        : 'tw-border-stone-200 focus:tw-border-stone-200 tw-bg-white active:tw-bg-stone-100 tw-text-stone-700'
                  }`}
                >
                  {f.label}
                  <span className={on ? 'tw-text-white/60' : 'tw-text-stone-400'}>{counts[f.id] || 0}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {items.length > 0 && !busy && (
        <div className="tw-flex tw-justify-end">
          <button
            type="button"
            onClick={retagAll}
            className="tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-text-sm tw-font-medium tw-text-stone-600 tw-underline tw-cursor-pointer"
          >
            ↻ Re-tag {activeFilter === 'all' ? 'all' : 'these'} ({visible.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-16">
          <Spinner className="tw-w-7 tw-h-7" />
        </div>
      ) : items.length === 0 ? (
        <div className="tw-rounded-2xl tw-border tw-border-dashed tw-border-stone-300 tw-px-6 tw-py-12 tw-text-center">
          <p className="tw-font-serif tw-text-xl tw-text-stone-900">Your closet is empty</p>
          <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-stone-500">
            Photograph each piece on its own — laid flat or on a hanger, in good light. You can pick several at once; each one is tagged automatically.
          </p>
        </div>
      ) : (
        <div className="tw-grid tw-grid-cols-3 tw-gap-x-3 tw-gap-y-4">
          {visible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              url={urls[item.image_path]}
              onClick={() => setEditing(item)}
              onDelete={async () => {
                await deleteItem(item)
                onItemsChange((prev) => prev.filter((it) => it.id !== item.id))
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemEditor
          item={editing}
          url={urls[editing.image_path]}
          onClose={closeEditor}
          onSaved={(updated) => {
            onItemsChange((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
            setEditing(null)
          }}
          onDeleted={(id) => {
            onItemsChange((prev) => prev.filter((it) => it.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
