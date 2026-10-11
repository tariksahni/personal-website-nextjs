import { CATEGORY_LABEL, BTN_PRIMARY, BTN_SECONDARY, Spinner } from './ui'

const ORDER = ['outerwear', 'top', 'bottom', 'shoes', 'accessory']

/**
 * One suggested outfit: thumbnails, name, reason, "Wearing this".
 * `itemsById` resolves outfit.item_ids against the loaded closet; ids of deleted items are skipped.
 */
export default function OutfitCard({ outfit, itemsById, urls, worn, wornOther, busy, disabled, onWear }) {
  const pieces = (outfit.item_ids || [])
    .map((id) => itemsById[id])
    .filter(Boolean)
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
  const missing = (outfit.item_ids || []).length - pieces.length

  return (
    <article
      className={`tw-rounded-2xl tw-border tw-border-solid tw-p-3 tw-transition-colors ${
        worn ? 'tw-border-emerald-300 tw-bg-emerald-50/60' : 'tw-border-stone-200 tw-bg-white'
      }`}
    >
      <div className="tw-flex tw-gap-2 tw-overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {pieces.map((it) => (
          <div key={it.id} className="tw-w-[72px] tw-shrink-0">
            <div className="tw-relative tw-w-[72px] tw-h-[72px] tw-overflow-hidden tw-rounded-xl tw-bg-stone-100">
              {urls[it.image_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[it.image_path]}
                  alt={it.subcategory || CATEGORY_LABEL[it.category] || ''}
                  loading="lazy"
                  className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover"
                />
              )}
            </div>
            <p className="tw-mt-1 tw-truncate tw-text-[11px] tw-text-stone-500 tw-capitalize">
              {it.subcategory || CATEGORY_LABEL[it.category]}
            </p>
          </div>
        ))}
        {pieces.length === 0 && (
          <p className="tw-py-4 tw-text-sm tw-text-stone-500">These items are no longer in your closet.</p>
        )}
      </div>

      <h3 className="tw-m-0 tw-mt-2 tw-font-serif tw-text-lg tw-font-normal tw-leading-snug tw-text-stone-900">{outfit.name}</h3>
      {outfit.reason && <p className="tw-mt-1 tw-text-sm tw-leading-relaxed tw-text-stone-600">{outfit.reason}</p>}
      {missing > 0 && pieces.length > 0 && (
        <p className="tw-mt-1 tw-text-xs tw-text-amber-700">
          {missing === 1 ? '1 item was' : `${missing} items were`} removed from your closet.
        </p>
      )}

      <div className="tw-mt-3">
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
    </article>
  )
}
