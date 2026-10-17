import { useState } from 'react'
import { CATEGORY_LABEL, FORMALITY_LABEL, BTN_PRIMARY, BTN_SECONDARY, Spinner } from './ui'
import { Overlay } from './LookViewer'

const ORDER = ['outerwear', 'top', 'bottom', 'shoes', 'accessory']
// Static class names so Tailwind keeps them.
const GRID_COLS = { 2: 'tw-grid-cols-2', 3: 'tw-grid-cols-3', 4: 'tw-grid-cols-4' }
const SHORT_LABEL = { top: 'Top', bottom: 'Bottom', shoes: 'Shoes', outerwear: 'Jacket', accessory: 'Extra' }

const NAV_BTN =
  'tw-inline-flex tw-flex-1 tw-items-center tw-justify-center tw-gap-2 tw-min-h-[44px] tw-m-0 tw-px-3 tw-rounded-xl tw-border tw-border-solid tw-border-white/20 focus:tw-border-white/20 tw-bg-white/10 active:tw-bg-white/20 tw-text-[15px] tw-font-medium tw-text-white tw-cursor-pointer disabled:tw-opacity-40 disabled:tw-cursor-not-allowed'

/** Full-screen view of one outfit piece, with prev/next through the outfit. */
function PieceViewer({ pieces, index, urls, onIndex, onClose }) {
  const it = pieces[index]
  const name = it.subcategory || CATEGORY_LABEL[it.category] || 'Item'
  const details = [
    CATEGORY_LABEL[it.category],
    (it.colors || []).join(', '),
    it.pattern,
    FORMALITY_LABEL[it.formality],
  ].filter(Boolean)
  return (
    <Overlay
      title={name.charAt(0).toUpperCase() + name.slice(1)}
      subtitle={details.join(' · ')}
      onClose={onClose}
      actions={
        pieces.length > 1 && (
          <div className="tw-flex tw-gap-2">
            <button type="button" className={NAV_BTN} disabled={index === 0} onClick={() => onIndex(index - 1)}>
              ← Prev
            </button>
            <span className="tw-flex tw-items-center tw-px-2 tw-text-sm tw-text-stone-400">
              {index + 1} / {pieces.length}
            </span>
            <button type="button" className={NAV_BTN} disabled={index === pieces.length - 1} onClick={() => onIndex(index + 1)}>
              Next →
            </button>
          </div>
        )
      }
    >
      {urls[it.image_path] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urls[it.image_path]} alt={name} className="tw-max-h-full tw-max-w-full tw-rounded-xl tw-object-contain" />
      ) : (
        <Spinner light className="tw-w-7 tw-h-7" />
      )}
      {it.description && (
        <p className="tw-absolute tw-bottom-2 tw-left-4 tw-right-4 tw-m-0 tw-rounded-lg tw-bg-black/55 tw-px-3 tw-py-2 tw-text-sm tw-text-stone-100">
          {it.description}
        </p>
      )}
    </Overlay>
  )
}

/**
 * One suggested outfit: thumbnails, name, reason, "Wearing this".
 * `itemsById` resolves outfit.item_ids against the loaded closet; ids of deleted items are skipped.
 */
export default function OutfitCard({ outfit, itemsById, urls, worn, wornOther, busy, disabled, onWear, onTryOn }) {
  const pieces = (outfit.item_ids || [])
    .map((id) => itemsById[id])
    .filter(Boolean)
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
  const missing = (outfit.item_ids || []).length - pieces.length
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <article
      className={`tw-rounded-2xl tw-border tw-border-solid tw-p-3 tw-transition-colors ${
        worn ? 'tw-border-emerald-300 tw-bg-emerald-50/60' : 'tw-border-stone-200 tw-bg-white'
      }`}
    >
      <div className={`tw-grid tw-gap-2 ${GRID_COLS[Math.min(Math.max(pieces.length, 2), 4)]}`}>
        {pieces.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`View ${it.subcategory || CATEGORY_LABEL[it.category] || 'item'}`}
            className="tw-group tw-block tw-w-full tw-min-w-0 tw-m-0 tw-p-0 tw-text-left tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-cursor-pointer"
          >
            <div className="tw-relative tw-aspect-square tw-w-full tw-overflow-hidden tw-rounded-xl tw-bg-stone-100">
              {urls[it.image_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[it.image_path]}
                  alt={it.subcategory || CATEGORY_LABEL[it.category] || ''}
                  loading="lazy"
                  className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover group-active:tw-scale-[0.98] tw-transition-transform"
                />
              )}
              <span className="tw-absolute tw-left-1.5 tw-top-1.5 tw-rounded-full tw-bg-white/90 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-text-stone-700 tw-shadow-sm">
                {SHORT_LABEL[it.category] || 'Item'}
              </span>
              <span aria-hidden className="tw-absolute tw-right-1.5 tw-bottom-1.5 tw-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-full tw-bg-black/45 tw-text-xs tw-text-white">
                ⤢
              </span>
            </div>
            <p className="tw-mt-1 tw-truncate tw-text-xs tw-text-stone-600 tw-capitalize">
              {it.subcategory || CATEGORY_LABEL[it.category]}
            </p>
          </button>
        ))}
        {pieces.length === 0 && (
          <p className="tw-col-span-full tw-py-4 tw-text-sm tw-text-stone-500">These items are no longer in your closet.</p>
        )}
      </div>

      <h3 className="tw-m-0 tw-mt-2 tw-font-serif tw-text-lg tw-font-normal tw-leading-snug tw-text-stone-900">{outfit.name}</h3>
      {outfit.reason && <p className="tw-mt-1 tw-text-sm tw-leading-relaxed tw-text-stone-600">{outfit.reason}</p>}
      {missing > 0 && pieces.length > 0 && (
        <p className="tw-mt-1 tw-text-xs tw-text-amber-700">
          {missing === 1 ? '1 item was' : `${missing} items were`} removed from your closet.
        </p>
      )}

      <div className="tw-mt-3 tw-space-y-2">
        {onTryOn && pieces.length > 0 && (
          <button type="button" onClick={() => onTryOn(pieces.map((it) => it.id))} className={`${BTN_SECONDARY} tw-w-full`}>
            <span aria-hidden>✧</span> Try it on
          </button>
        )}
        {worn ? (
          <div className="tw-flex tw-min-h-[44px] tw-items-center tw-justify-center tw-gap-2 tw-rounded-xl tw-bg-emerald-600 tw-text-[15px] tw-font-medium tw-text-white">
            <span aria-hidden>✓</span> Wearing today
          </div>
        ) : (
          <button
            type="button"
            onClick={onWear}
            disabled={disabled || pieces.length === 0}
            className={`${wornOther ? BTN_SECONDARY : BTN_PRIMARY} tw-w-full`}
          >
            {busy ? <Spinner light={!wornOther} className="tw-w-4 tw-h-4" /> : null}
            {wornOther ? 'Wear this instead' : 'Wearing this'}
          </button>
        )}
      </div>

      {openIndex !== null && pieces[openIndex] && (
        <PieceViewer pieces={pieces} index={openIndex} urls={urls} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </article>
  )
}
