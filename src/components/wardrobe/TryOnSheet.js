import { useCallback, useEffect, useRef, useState } from 'react'
import { PHOTO_SLOTS, findLook, generateLook, getOwnerPhotos } from 'Lib/wardrobe/tryon'
import { Overlay, LookImage, SaveShareButtons, DARK_BTN } from './LookViewer'
import { Spinner } from './ui'

const PRIMARY_LIGHT =
  'tw-inline-flex tw-w-full tw-items-center tw-justify-center tw-gap-2 tw-min-h-[44px] tw-m-0 tw-px-4 tw-rounded-xl tw-border-0 focus:tw-border-0 tw-bg-white active:tw-bg-stone-200 tw-text-[15px] tw-font-medium tw-text-stone-900 tw-cursor-pointer disabled:tw-opacity-50'

const EMPTY = { phase: 'idle', look: null, error: null, startedAt: 0 } // phase: idle | generating | done | error

/**
 * "Try it on" flow for one outfit. The owner can have two photos (Photo 1 / Photo 2): choose one
 * or both before generating. Cached looks per photo show immediately; "Both" runs two jobs in
 * parallel and the results are shown with a Photo 1 / Photo 2 toggle (tap or swipe).
 */
export default function TryOnSheet({ outfit, itemIds, onClose, onGoToMe }) {
  const [phase, setPhase] = useState('checking') // checking | needPhoto | choose | results | error
  const [photos, setPhotos] = useState({ 1: null, 2: null })
  const [slots, setSlots] = useState({ 1: EMPTY, 2: EMPTY })
  const [active, setActive] = useState(1)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())
  const closed = useRef(false)
  const touchX = useRef(null)

  useEffect(
    () => () => {
      closed.current = true
    },
    []
  )

  const patch = (slot, v) => setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...v } }))

  const generate = useCallback(
    async (slot, resumeOnly = false) => {
      setPhase('results')
      patch(slot, { phase: 'generating', error: null, startedAt: Date.now() })
      try {
        const res = await generateLook({
          itemIds,
          outfitName: outfit && outfit.name,
          photo: slot,
          isCancelled: () => closed.current,
          resumeOnly,
        })
        if (closed.current || !res) return
        patch(slot, { phase: 'done', look: res })
      } catch (e) {
        if (closed.current) return
        patch(slot, { phase: 'error', error: e.message })
      }
    },
    [itemIds, outfit]
  )

  const startSlots = (list) => {
    setActive(list[0])
    list.forEach((slot) => generate(slot, false))
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([findLook(itemIds, 1), findLook(itemIds, 2), getOwnerPhotos()])
      .then(([c1, c2, ph]) => {
        if (cancelled) return
        setPhotos(ph)
        const cached = { 1: c1, 2: c2 }
        const shown = PHOTO_SLOTS.filter((s) => cached[s].url || cached[s].pending)
        if (shown.length) {
          setSlots((prev) => {
            const next = { ...prev }
            shown.forEach((s) => {
              if (cached[s].url) next[s] = { ...EMPTY, phase: 'done', look: cached[s] }
            })
            return next
          })
          setActive(shown[0])
          setPhase('results')
          shown.filter((s) => !cached[s].url).forEach((s) => generate(s, true))
          return
        }
        const available = PHOTO_SLOTS.filter((s) => ph[s])
        if (available.length === 0) setPhase('needPhoto')
        else if (available.length === 1) startSlots(available)
        else setPhase('choose')
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

  const anyGenerating = PHOTO_SLOTS.some((s) => slots[s].phase === 'generating')
  useEffect(() => {
    if (!anyGenerating) return undefined
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [anyGenerating])

  const regenerate = (slot) => {
    if (!window.confirm(`Regenerate this look with Photo ${slot}? It replaces the current image and makes a new paid OpenAI request.`)) return
    generate(slot, false)
  }

  // Tabs: every slot that has a photo or a look.
  const tabs = PHOTO_SLOTS.filter((s) => photos[s] || slots[s].phase !== 'idle')
  const showTabs = phase === 'results' && tabs.length > 1
  const onTouchStart = (e) => {
    touchX.current = e.touches && e.touches[0] ? e.touches[0].clientX : null
  }
  const onTouchEnd = (e) => {
    if (!showTabs || touchX.current === null || !e.changedTouches || !e.changedTouches[0]) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 50) return
    const i = tabs.indexOf(active)
    const next = tabs[Math.min(tabs.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))]
    if (next) setActive(next)
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
          Try-on edits a photo of you and only swaps the clothes. Add one (or two) in the Me tab — full-body, front-facing, good light
          works best.
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
  } else if (phase === 'choose') {
    body = (
      <div className="tw-w-full tw-max-w-sm tw-text-center">
        <p className="tw-font-serif tw-text-xl">Which photo?</p>
        <div className="tw-mt-4 tw-flex tw-gap-3">
          {PHOTO_SLOTS.map((s) => (
            <div key={s} className="tw-flex-1 tw-min-w-0">
              <div className="tw-relative tw-w-full tw-aspect-[3/4] tw-overflow-hidden tw-rounded-xl tw-bg-white/10">
                {photos[s] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[s].url} alt={`Photo ${s}`} className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
                )}
              </div>
              <p className="tw-mt-2 tw-mb-0 tw-text-sm tw-text-stone-300">Photo {s}</p>
            </div>
          ))}
        </div>
      </div>
    )
    actions = (
      <>
        <div className="tw-flex tw-gap-2">
          {PHOTO_SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => startSlots([s])} className={DARK_BTN}>
              Photo {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => startSlots(PHOTO_SLOTS)} className={PRIMARY_LIGHT}>
          Both
        </button>
      </>
    )
  } else if (phase === 'results') {
    const slot = tabs.includes(active) ? active : tabs[0] || active
    const st = slots[slot]
    if (st.phase === 'generating') {
      const elapsed = Math.max(0, Math.round((now - st.startedAt) / 1000))
      body = (
        <div className="tw-text-center">
          <Spinner light className="tw-w-9 tw-h-9" />
          <p className="tw-mt-4 tw-font-serif tw-text-xl">Generating your look…</p>
          <p className="tw-mt-1 tw-text-sm tw-text-stone-400">
            Photo {slot} · usually 1–2 min · {elapsed}s
          </p>
          <p className="tw-mt-4 tw-max-w-xs tw-text-xs tw-leading-relaxed tw-text-stone-500">
            You can close this — the result will appear in My looks (Me tab) when it&apos;s ready.
          </p>
        </div>
      )
    } else if (st.phase === 'done' && st.look) {
      body = <LookImage key={st.look.url} url={st.look.url} alt={`You wearing ${title} (Photo ${slot})`} />
      actions = (
        <>
          <SaveShareButtons url={st.look.url} name={`look-${st.look.key.slice(0, 8)}-photo${slot}`} />
          <button type="button" onClick={() => regenerate(slot)} className={`${DARK_BTN} tw-w-full`}>
            <span aria-hidden>↻</span> Regenerate
          </button>
        </>
      )
    } else if (st.phase === 'error') {
      body = (
        <div className="tw-max-w-xs tw-text-center">
          <p className="tw-font-serif tw-text-xl">Couldn&apos;t create the look</p>
          <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-rose-200 tw-whitespace-pre-line">{st.error}</p>
        </div>
      )
      actions = (
        <button type="button" onClick={() => generate(slot, false)} className={PRIMARY_LIGHT}>
          Try again
        </button>
      )
    } else {
      body = (
        <div className="tw-max-w-xs tw-text-center">
          <p className="tw-font-serif tw-text-xl">No look with Photo {slot} yet</p>
        </div>
      )
      actions = photos[slot] ? (
        <button type="button" onClick={() => generate(slot, false)} className={PRIMARY_LIGHT}>
          Generate with Photo {slot}
        </button>
      ) : null
    }
    if (showTabs) {
      body = (
        <div className="tw-absolute tw-inset-0 tw-flex tw-flex-col tw-px-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div role="tablist" aria-label="Photo" className="tw-mx-auto tw-mb-3 tw-flex tw-shrink-0 tw-gap-1 tw-rounded-full tw-bg-white/10 tw-p-1">
            {tabs.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === slot}
                onClick={() => setActive(s)}
                className={`tw-m-0 tw-min-h-[36px] tw-px-4 tw-rounded-full tw-border-0 focus:tw-border-0 tw-text-sm tw-font-medium tw-cursor-pointer ${
                  s === slot ? 'tw-bg-white tw-text-stone-900' : 'tw-bg-transparent tw-text-stone-300'
                }`}
              >
                Photo {s}
                {slots[s].phase === 'generating' ? ' …' : ''}
              </button>
            ))}
          </div>
          <div className="tw-relative tw-flex-1 tw-min-h-0 tw-flex tw-items-center tw-justify-center">{body}</div>
        </div>
      )
    }
  } else {
    body = (
      <div className="tw-max-w-xs tw-text-center">
        <p className="tw-font-serif tw-text-xl">Couldn&apos;t open try-on</p>
        <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-rose-200 tw-whitespace-pre-line">{error}</p>
      </div>
    )
  }

  return (
    <Overlay title={title} subtitle="Try it on" onClose={onClose} actions={actions}>
      {body}
    </Overlay>
  )
}
