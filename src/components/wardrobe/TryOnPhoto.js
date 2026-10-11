import { useEffect, useRef, useState } from 'react'
import { resizeImage } from 'Lib/wardrobe/image'
import { deleteOwnerPhoto, getOwnerPhoto, uploadOwnerPhoto } from 'Lib/wardrobe/tryon'
import { BTN_SECONDARY, BTN_DANGER, CARD, Spinner, ErrorBanner, SectionTitle } from './ui'

const MAX_PX = 1536
const QUALITY = 0.85

/** Me tab: the single stored photo used as the base image for try-on. */
export default function TryOnPhoto() {
  const [photo, setPhoto] = useState(null) // { path, url, updatedAt }
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null) // 'upload' | 'delete'
  const [error, setError] = useState(null)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getOwnerPhoto()
      .then(setPhoto)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy('upload')
    setError(null)
    try {
      const { blob } = await resizeImage(file, MAX_PX, QUALITY)
      setPhoto(await uploadOwnerPhoto(blob))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete your try-on photo? Saved looks are kept.')) return
    setBusy('delete')
    setError(null)
    try {
      await deleteOwnerPhoto()
      setPhoto(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <SectionTitle>Your photo for try-on</SectionTitle>
      <p className="tw-mb-4 tw-text-sm tw-leading-relaxed tw-text-stone-500">
        One photo of you — try-on keeps it the same and only swaps the clothes. Best: well-lit, full-body, front-facing.
      </p>
      <div className={`${CARD} tw-p-4 tw-space-y-4`}>
        <input ref={galleryRef} type="file" accept="image/*" onChange={pick} className="tw-hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={pick} className="tw-hidden" />

        <div className="tw-flex tw-gap-4">
          <div className="tw-relative tw-w-24 tw-h-32 tw-shrink-0 tw-overflow-hidden tw-rounded-xl tw-bg-stone-100 tw-flex tw-items-center tw-justify-center">
            {loading || busy === 'upload' ? (
              <Spinner />
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Your try-on photo" className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
            ) : (
              <span className="tw-px-2 tw-text-center tw-text-xs tw-text-stone-400">No photo yet</span>
            )}
          </div>
          <div className="tw-flex-1 tw-min-w-0 tw-flex tw-flex-col tw-gap-2">
            <button
              type="button"
              onClick={() => galleryRef.current && galleryRef.current.click()}
              disabled={!!busy || loading}
              className={`${BTN_SECONDARY} tw-w-full`}
            >
              {photo ? 'Replace photo' : 'Choose photo'}
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current && cameraRef.current.click()}
              disabled={!!busy || loading}
              className={`${BTN_SECONDARY} tw-w-full`}
            >
              Take photo
            </button>
            {photo && (
              <button type="button" onClick={remove} disabled={!!busy} className={`${BTN_DANGER} tw-w-full`}>
                {busy === 'delete' ? <Spinner className="tw-w-4 tw-h-4" /> : null}
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-bg-emerald-50 tw-px-3 tw-py-2.5 tw-text-xs tw-leading-snug tw-text-emerald-900">
          <span aria-hidden>🔒</span>
          <span>
            Stored privately in your wardrobe (only you can see it) and only used for try-on. It is sent to OpenAI only when you tap
            “Try it on”.
          </span>
        </div>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>
    </section>
  )
}
