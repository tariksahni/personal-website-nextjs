import { useCallback, useEffect, useRef, useState } from 'react'
import { findLook, generateLook, getOwnerPhoto } from 'Lib/wardrobe/tryon'
import { Overlay, LookImage, SaveShareButtons, DARK_BTN } from './LookViewer'
import { Spinner } from './ui'

const PRIMARY_LIGHT =
  'tw-inline-flex tw-w-full tw-items-center tw-justify-center tw-gap-2 tw-min-h-[44px] tw-m-0 tw-px-4 tw-rounded-xl tw-border-0 focus:tw-border-0 tw-bg-white active:tw-bg-stone-200 tw-text-[15px] tw-font-medium tw-text-stone-900 tw-cursor-pointer disabled:tw-opacity-50'

/**
 * "Try it on" flow for one outfit: cached look → shown immediately; otherwise generates
 * (needs the owner photo from the Me tab), shows progress, then the result.
 */
export default function TryOnSheet({ outfit, itemIds, onClose, onGoToMe }) {
  const [phase, setPhase] = useState('checking') // checking | needPhoto | generating | done | error
  const [look, setLook] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const closed = useRef(false)

  useEffect(
    () => () => {
      closed.current = true
    },
    []
  )

  const generate = useCallback(
    async (resumeOnly = false) => {
      setPhase('generating')
      setError(null)
      try {
        const res = await generateLook({
          itemIds,
          outfitName: outfit && outfit.name,
          isCancelled: () => closed.current,
          resumeOnly,
        })
        if (closed.current || !res) return
        setLook(res)
        setPhase('done')
      } catch (e) {
        if (closed.current) return
        if (/add your photo/i.test(e.message || '')) {
          setPhase('needPhoto')
          return
        }
        setError(e.message)
        setPhase('error')
      }
    },
    [itemIds, outfit]
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([findLook(itemIds), getOwnerPhoto()])
      .then(([cached, photo]) => {
        if (cancelled) return
        if (cached.url) {
          setLook(cached)
          setPhase('done')
        } else if (cached.pending) {
          generate(true)
        } else if (!photo) {
          setPhase('needPhoto')
        } else {
          generate(false)
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
    // Run once per opened sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'generating') return undefined
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const regenerate = () => {
    if (!window.confirm('Regenerate this look? It replaces the current image and makes a new paid OpenAI request.')) return
    generate(false)
  }

  const title = (outfit && outfit.name) || 'Try it on'
  let body = null
  let actions = null

  if (phase === 'checking') {
    body = <Spinner light className="tw-w-7 tw-h-7" />
  } else if (phase === 'needPhoto') {
    body = (
      <div className="tw-max-w-xs tw-text-center">
        <p className="tw-font-serif tw-text-xl">Add your photo first</p>
        <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-stone-300">
          Try-on edits one photo of you and only swaps the clothes. Add it in the Me tab — well-lit, full-body, front-facing works best.
        </p>
      </div>
    )
    actions = (
      <button
        type="button"
        onClick={() => {
          onClose()
          onGoToMe()
        }}
        className={PRIMARY_LIGHT}
      >
        Go to Me tab
      </button>
    )
  } else if (phase === 'generating') {
    body = (
      <div className="tw-text-center">
        <Spinner light className="tw-w-9 tw-h-9" />
        <p className="tw-mt-4 tw-font-serif tw-text-xl">Generating your look…</p>
        <p className="tw-mt-1 tw-text-sm tw-text-stone-400">Usually 30–60s · {elapsed}s</p>
        <p className="tw-mt-4 tw-max-w-xs tw-text-xs tw-leading-relaxed tw-text-stone-500">
          You can close this — the result will appear in My looks (Me tab) when it&apos;s ready.
        </p>
      </div>
    )
  } else if (phase === 'done' && look) {
    body = <LookImage url={look.url} alt={`You wearing ${title}`} />
    actions = (
      <>
        <SaveShareButtons url={look.url} name={`look-${look.key.slice(0, 8)}`} />
        <button type="button" onClick={regenerate} className={`${DARK_BTN} tw-w-full`}>
          <span aria-hidden>↻</span> Regenerate
        </button>
      </>
    )
  } else {
    body = (
      <div className="tw-max-w-xs tw-text-center">
        <p className="tw-font-serif tw-text-xl">Couldn&apos;t create the look</p>
        <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-rose-200 tw-whitespace-pre-line">{error}</p>
      </div>
    )
    actions = (
      <button type="button" onClick={() => generate(false)} className={PRIMARY_LIGHT}>
        Try again
      </button>
    )
  }

  return (
    <Overlay title={title} subtitle="Try it on" onClose={onClose} actions={actions}>
      {body}
    </Overlay>
  )
}
