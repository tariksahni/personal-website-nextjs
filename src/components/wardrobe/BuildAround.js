import { useCallback, useEffect, useState } from 'react'
import { callFn } from 'Lib/wardrobe/api'
import ItemCard from './ItemCard'
import OutfitCard from './OutfitCard'
import { BTN_BASE, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, CARD, CATEGORY_LABEL, Spinner, ErrorBanner, Notice, SectionTitle } from './ui'

const PICK_FILTERS = [
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'outerwear', label: 'Jackets' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories' },
]
const MAX_AVOID = 30

export function pieceName(item) {
  return (item && (item.subcategory || CATEGORY_LABEL[item.category])) || 'piece'
}

function sameIds(a, b) {
  if (!a || !b || a.length !== b.length) return false
  const s = new Set(a)
  return b.every((id) => s.has(id))
}

/** Bottom sheet: choose one tagged closet item to build outfits around. */
function PiecePicker({ items, urls, initialCategory, onPick, onClose }) {
  const tagged = items.filter((it) => it.category)
  const counts = tagged.reduce((acc, it) => ({ ...acc, [it.category]: (acc[it.category] || 0) + 1 }), {})
  const firstWithItems = (PICK_FILTERS.find((f) => counts[f.id]) || PICK_FILTERS[0]).id
  const [filter, setFilter] = useState(initialCategory && counts[initialCategory] ? initialCategory : firstWithItems)
  const visible = tagged.filter((it) => it.category === filter)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-end tw-justify-center" role="dialog" aria-modal="true" aria-label="Pick a piece">
      <div className="tw-absolute tw-inset-0 tw-bg-stone-900/50" onClick={onClose} />
      <div
        className="tw-relative tw-w-full tw-max-w-md tw-max-h-[88vh] tw-overflow-y-auto tw-rounded-t-3xl tw-bg-stone-50 tw-shadow-2xl"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div className="tw-sticky tw-top-0 tw-z-10 tw-bg-stone-50/95 tw-px-4 tw-pt-2 tw-pb-3 tw-backdrop-blur">
          <div className="tw-flex tw-items-center tw-justify-between">
            <span className="tw-w-11" />
            <span className="tw-h-1 tw-w-10 tw-rounded-full tw-bg-stone-300" />
            <button type="button" aria-label="Close" onClick={onClose} className={`${BTN_GHOST} tw-w-11 tw-px-0 tw-text-2xl`}>
              ×
            </button>
          </div>
          <p className="tw-m-0 tw-font-serif tw-text-xl tw-text-stone-900">Pick a piece</p>
          <div className="-tw-mx-4 tw-mt-3 tw-overflow-x-auto tw-px-4" style={{ scrollbarWidth: 'none' }}>
            <div className="tw-flex tw-gap-2 tw-w-max">
              {PICK_FILTERS.map((f) => {
                const on = filter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={on}
                    className={`${BTN_BASE} tw-min-h-[36px] tw-px-3.5 tw-rounded-full tw-text-sm tw-border tw-border-solid ${
                      on
                        ? 'tw-border-stone-900 focus:tw-border-stone-900 tw-bg-stone-900 active:tw-bg-stone-800 tw-text-white'
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
        </div>
        <div className="tw-px-4">
          {visible.length === 0 ? (
            <p className="tw-py-10 tw-text-center tw-text-sm tw-text-stone-500">Nothing tagged in this category yet.</p>
          ) : (
            <div className="tw-grid tw-grid-cols-3 tw-gap-x-3 tw-gap-y-4">
              {visible.map((it) => (
                <ItemCard key={it.id} item={it} url={urls[it.image_path]} onClick={() => onPick(it)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * "Build around a piece": up to 7 outfits that all include one chosen item.
 * State lives in the page (`anchor` / `setAnchor`) so it survives tab switches and "Style this piece" from the Closet:
 *   anchor = { id, payload, pending, error, start }   // start: set by the Closet to auto-generate once
 */
export default function BuildAround({ items, urls, itemsById, anchor, setAnchor, date, includeJacket, wearLog, wearing, onWear, onTryOn }) {
  const [picking, setPicking] = useState(false)
  const item = anchor && anchor.id ? itemsById[anchor.id] : null
  const payload = anchor && anchor.payload && anchor.payload.anchorId === anchor.id ? anchor.payload : null
  const outfits = (payload && payload.outfits) || []
  const pending = !!(anchor && anchor.pending)

  const run = async (id, avoid) => {
    setAnchor((a) => ({ ...(a && a.id === id ? a : { id, payload: null }), pending: true, error: null, start: null }))
    try {
      const body = { occasion: 'office', date, includeJacket, anchorId: id }
      if (avoid && avoid.length) body.avoid = avoid.slice(0, MAX_AVOID)
      const result = await callFn('wardrobe-suggest', body, { timeoutMs: 60000 })
      setAnchor((a) => (a && a.id === id ? { ...a, payload: result, pending: false, error: null } : a))
    } catch (e) {
      setAnchor((a) => (a && a.id === id ? { ...a, pending: false, error: e.message } : a))
    }
  }

  // "Style this piece" from the Closet: generate once on arrival.
  const startToken = anchor && anchor.start
  useEffect(() => {
    if (startToken && anchor.id && !anchor.pending) run(anchor.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startToken])

  // The anchor was deleted from the closet: forget it.
  useEffect(() => {
    if (anchor && anchor.id && items.length && !itemsById[anchor.id] && !anchor.pending) setAnchor(null)
  }, [anchor, items.length, itemsById, setAnchor])

  const pick = (it) => {
    setPicking(false)
    run(it.id)
  }
  const refresh = () => run(anchor.id, outfits.map((o) => o.item_ids || []).filter((ids) => ids.length))
  const clear = () => setAnchor(null)
  const closePicker = useCallback(() => setPicking(false), [])
  const name = pieceName(item)

  return (
    <section className={pending && payload ? 'tw-opacity-90' : ''}>
      <SectionTitle>Build around a piece</SectionTitle>
      <div className="tw-space-y-3">
        {!item ? (
          <div className={`${CARD} tw-p-4`}>
            <p className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-stone-600">
              Got something you want to wear? Pick it and get outfits that all include it.
            </p>
            <button type="button" onClick={() => setPicking(true)} className={`${BTN_SECONDARY} tw-mt-3 tw-w-full`}>
              <span aria-hidden>◎</span> Pick a piece
            </button>
          </div>
        ) : (
          <div className={`${CARD} tw-p-3`}>
            <div className="tw-flex tw-items-center tw-gap-3">
              <div className="tw-relative tw-h-16 tw-w-16 tw-shrink-0 tw-overflow-hidden tw-rounded-xl tw-bg-stone-200">
                {urls[item.image_path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[item.image_path]} alt="" className="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover" />
                )}
              </div>
              <div className="tw-min-w-0 tw-flex-1">
                <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-stone-400">Styling around</p>
                <p className="tw-m-0 tw-mt-0.5 tw-truncate tw-font-serif tw-text-lg tw-capitalize tw-text-stone-900">{name}</p>
              </div>
              <button type="button" aria-label="Clear piece" onClick={clear} disabled={pending} className={`${BTN_GHOST} tw-w-11 tw-px-0 tw-text-2xl`}>
                ×
              </button>
            </div>
            <div className="tw-mt-3 tw-grid tw-grid-cols-[auto_1fr] tw-gap-2">
              <button type="button" onClick={() => setPicking(true)} disabled={pending} className={BTN_SECONDARY}>
                Change
              </button>
              <button type="button" onClick={refresh} disabled={pending} className={payload ? BTN_SECONDARY : BTN_PRIMARY}>
                {pending ? <Spinner className="tw-w-4 tw-h-4" /> : <span aria-hidden>↻</span>}
                {payload ? 'Refresh — new outfits' : 'Suggest outfits'}
              </button>
            </div>
          </div>
        )}

        {pending && (
          <div className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-py-2 tw-text-sm tw-text-stone-500" aria-live="polite">
            <Spinner className="tw-w-4 tw-h-4" />
            Styling around your {name.toLowerCase()}…
          </div>
        )}

        {anchor && anchor.error && !pending && (
          <ErrorBanner message={anchor.error} onRetry={item ? () => run(anchor.id) : undefined} />
        )}

        {payload && payload.cooldownRelaxed && (
          <Notice>Not enough fresh tops, so some worn in the last 4 days are included.</Notice>
        )}

        {item && payload && (
          <div className={`tw-space-y-3 ${pending ? 'tw-opacity-60 tw-transition-opacity' : 'tw-transition-opacity'}`}>
            {outfits.map((outfit, i) => (
              <OutfitCard
                key={`anchor-${(outfit.item_ids || []).join('-')}`}
                outfit={outfit}
                itemsById={itemsById}
                urls={urls}
                worn={!!wearLog && sameIds(wearLog.item_ids, (outfit.item_ids || []).filter((x) => itemsById[x]))}
                wornOther={!!wearLog}
                busy={wearing === `anchor:${i}`}
                disabled={!!wearing}
                onWear={() => onWear(outfit, i)}
                onTryOn={(itemIds) => onTryOn({ outfit, itemIds })}
              />
            ))}
          </div>
        )}
      </div>

      {picking && (
        <PiecePicker
          items={items}
          urls={urls}
          initialCategory={item ? item.category : null}
          onPick={pick}
          onClose={closePicker}
        />
      )}
    </section>
  )
}
