import { useEffect, useRef, useState } from 'react'
import { resizeImage } from 'Lib/wardrobe/image'
import { PHOTO_SLOTS, deleteOwnerPhoto, getOwnerPhotos, uploadOwnerPhoto } from 'Lib/wardrobe/tryon'
import { BTN_SECONDARY, BTN_DANGER, CARD, Spinner, ErrorBanner, SectionTitle } from './ui'

// Quality first: up to 2048px long edge (OpenAI's vision max), JPEG 0.9. Uploaded straight to
// storage (not through a function), so the 6MB function body limit doesn't apply.
const MAX_PX = 2048
const QUALITY = 0.9
const SMALL_BTN = `${BTN_SECONDARY} tw-w-full !tw-min-h-[40px] !tw-px-2 !tw-text-sm`

/** One photo slot: preview + choose / take / delete. */
function PhotoSlot({ slot, photo, loading, busy, onPick, onDelete }) {
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const disabled = !!busy || loading
  const pick = (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (file) onPick(slot, file)
  }

  return (
    <div className="tw-flex-1 tw-min-w-0 tw-flex tw-flex-col tw-gap-2">
      <p className="tw-m-0 tw-text-xs tw-font-medium tw-uppercase tw-tracking-wide tw-text-stone-500">Photo {slot}</p>
      <input ref={galleryRef} type="file" accept="image/*" onChange={pick} className="tw-hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={pick} className="tw-hidden" />
      <div className="tw-relative tw-w-full tw-aspect-[3/4] tw-overflow-hidden tw-rounded-xl tw-bg-stone-100 tw-flex tw-items-center tw-justify-center">
        {loading || busy === 'upload' ? (
          <Spinner />
        ) : photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={`Your try-on photo ${slot}`} className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
        ) : (
          <span className="tw-px-2 tw-text-center tw-text-xs tw-text-stone-400">No photo yet</span>
        )}
      </div>
      <button type="button" onClick={() => galleryRef.current && galleryRef.current.click()} disabled={disabled} className={SMALL_BTN}>
        {photo ? 'Replace' : 'Choose'}
      </button>
      <button type="button" onClick={() => cameraRef.current && cameraRef.current.click()} disabled={disabled} className={SMALL_BTN}>
        Take photo
      </button>
      {photo && (
        <button
          type="button"
          onClick={() => onDelete(slot)}
          disabled={disabled}
          className={`${BTN_DANGER} tw-w-full !tw-min-h-[40px] !tw-px-2 !tw-text-sm`}
        >
          {busy === 'delete' ? <Spinner className="tw-w-4 tw-h-4" /> : null}
          Delete
        </button>
      )}
    </div>
  )
}

/** Me tab: the two stored photos ("Photo 1", "Photo 2") used as base images for try-on. */
export default function TryOnPhoto() {
  const [photos, setPhotos] = useState({ 1: null, 2: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({}) // { [slot]: 'upload' | 'delete' }
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getOwnerPhotos()
      .then(setPhotos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const setSlotBusy = (slot, v) => setBusy((b) => ({ ...b, [slot]: v }))

  const pick = async (slot, file) => {
    setSlotBusy(slot, 'upload')
    setError(null)
    try {
      const { blob } = await resizeImage(file, MAX_PX, QUALITY)
      const saved = await uploadOwnerPhoto(blob, slot)
      setPhotos((p) => ({ ...p, [slot]: saved }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSlotBusy(slot, null)
    }
  }

  const remove = async (slot) => {
    if (!window.confirm(`Delete Photo ${slot}? Saved looks are kept.`)) return
    setSlotBusy(slot, 'delete')
    setError(null)
    try {
      await deleteOwnerPhoto(slot)
      setPhotos((p) => ({ ...p, [slot]: null }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSlotBusy(slot, null)
    }
  }

  return (
    <section>
      <SectionTitle>Your photos for try-on</SectionTitle>
      <p className="tw-mb-4 tw-text-sm tw-leading-relaxed tw-text-stone-500">
        Up to two photos of you — try-on keeps you the same and only swaps the clothes. e.g. Photo 1 with sunglasses, Photo 2 with your
        specs. Full-body, front-facing, good light.
      </p>
      <div className={`${CARD} tw-p-4 tw-space-y-4`}>
        <div className="tw-flex tw-gap-3">
          {PHOTO_SLOTS.map((slot) => (
            <PhotoSlot
              key={slot}
              slot={slot}
              photo={photos[slot]}
              loading={loading}
              busy={busy[slot]}
              onPick={pick}
              onDelete={remove}
            />
          ))}
        </div>

        <div className="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-bg-emerald-50 tw-px-3 tw-py-2.5 tw-text-xs tw-leading-snug tw-text-emerald-900">
          <span aria-hidden>🔒</span>
          <span>
            Stored privately in your wardrobe (only you can see them) and only used for try-on. A photo is sent to OpenAI only when you tap
            “Try it on” with it.
          </span>
        </div>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>
    </section>
  )
}
