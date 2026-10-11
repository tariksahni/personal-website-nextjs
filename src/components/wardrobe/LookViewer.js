import { useEffect, useState } from 'react'
import { canShareFiles, saveOrShareLook } from 'Lib/wardrobe/tryon'
import { Spinner } from './ui'

const DARK_BTN =
  'tw-inline-flex tw-flex-1 tw-items-center tw-justify-center tw-gap-2 tw-min-h-[44px] tw-m-0 tw-px-3 tw-rounded-xl tw-border tw-border-solid tw-border-white/20 focus:tw-border-white/20 tw-bg-white/10 active:tw-bg-white/20 tw-text-[15px] tw-font-medium tw-text-white tw-cursor-pointer disabled:tw-opacity-50 disabled:tw-cursor-not-allowed'

/** Locks page scroll while a full-screen overlay is open. */
export function useScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
}

/**
 * Full-screen dark overlay. `children` = body (image / status), `actions` = bottom buttons.
 */
export function Overlay({ title, subtitle, onClose, children, actions }) {
  useScrollLock()
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="wardrobe-root tw-fixed tw-inset-0 tw-z-50 tw-flex tw-flex-col tw-bg-stone-950 tw-text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-h-14 tw-shrink-0">
        <div className="tw-flex-1 tw-min-w-0">
          <p className="tw-m-0 tw-truncate tw-font-serif tw-text-lg">{title}</p>
          {subtitle && <p className="tw-m-0 tw-truncate tw-text-xs tw-text-stone-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tw-m-0 tw-w-11 tw-h-11 -tw-mr-2 tw-rounded-full tw-border-0 tw-bg-transparent active:tw-bg-white/10 focus:tw-border-0 tw-text-2xl tw-leading-none tw-text-white tw-cursor-pointer"
        >
          ×
        </button>
      </div>
      <div className="tw-relative tw-flex-1 tw-min-h-0 tw-flex tw-items-center tw-justify-center tw-px-4">{children}</div>
      {actions && <div className="tw-shrink-0 tw-px-4 tw-pt-3 tw-pb-4 tw-space-y-2">{actions}</div>}
    </div>
  )
}

export function LookImage({ url, alt = 'Your look' }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      {!loaded && <Spinner light className="tw-absolute tw-w-7 tw-h-7" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`tw-block tw-max-w-full tw-max-h-full tw-rounded-xl tw-object-contain tw-transition-opacity ${loaded ? 'tw-opacity-100' : 'tw-opacity-0'}`}
      />
    </>
  )
}

/** Download + (where supported) Share buttons for a look. */
export function SaveShareButtons({ url, name }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [shareable, setShareable] = useState(false)
  useEffect(() => setShareable(canShareFiles()), [])

  const run = async (share) => {
    setBusy(share ? 'share' : 'download')
    setMsg(null)
    try {
      await saveOrShareLook(url, { share, name })
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="tw-flex tw-gap-2">
        <button type="button" onClick={() => run(false)} disabled={!!busy || !url} className={DARK_BTN}>
          {busy === 'download' ? <Spinner light className="tw-w-4 tw-h-4" /> : <span aria-hidden>↓</span>}
          Download
        </button>
        {shareable && (
          <button type="button" onClick={() => run(true)} disabled={!!busy || !url} className={DARK_BTN}>
            {busy === 'share' ? <Spinner light className="tw-w-4 tw-h-4" /> : <span aria-hidden>↗</span>}
            Share
          </button>
        )}
      </div>
      {msg && <p className="tw-m-0 tw-text-center tw-text-xs tw-text-rose-300">{msg}</p>}
    </>
  )
}

export { DARK_BTN }

/** Viewer for a saved look (gallery): image + Download/Share + Delete. */
export default function LookViewer({ look, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const date = look.updatedAt ? new Date(look.updatedAt).toLocaleDateString() : ''

  const remove = async () => {
    if (!window.confirm('Delete this look?')) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(look)
    } catch (e) {
      setError(e.message)
      setDeleting(false)
    }
  }

  return (
    <Overlay
      title="My look"
      subtitle={date}
      onClose={onClose}
      actions={
        <>
          <SaveShareButtons url={look.url} name={`look-${look.key.slice(0, 8)}`} />
          <button type="button" onClick={remove} disabled={deleting} className={`${DARK_BTN} tw-w-full tw-text-rose-300`}>
            {deleting ? <Spinner light className="tw-w-4 tw-h-4" /> : null}
            Delete look
          </button>
          {error && <p className="tw-m-0 tw-text-center tw-text-xs tw-text-rose-300">{error}</p>}
        </>
      }
    >
      {look.url ? <LookImage url={look.url} /> : <p className="tw-text-sm tw-text-stone-400">Image unavailable.</p>}
    </Overlay>
  )
}
