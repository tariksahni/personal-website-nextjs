import { CATEGORY_LABEL } from './ui'

/** Square closet tile. Shows a "Needs tags" badge when the item has no category. */
export default function ItemCard({ item, url, onClick }) {
  const label = item.subcategory || CATEGORY_LABEL[item.category] || 'Item'
  const needsTags = !item.category
  return (
    <button
      type="button"
      onClick={onClick}
      className="tw-group tw-relative tw-block tw-w-full tw-m-0 tw-p-0 tw-text-left tw-border-0 tw-bg-transparent active:tw-bg-transparent tw-cursor-pointer tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-stone-400 tw-rounded-xl"
    >
      <div className="tw-relative tw-aspect-square tw-w-full tw-overflow-hidden tw-rounded-xl tw-bg-stone-200">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={item.description || label}
            loading="lazy"
            className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover group-active:tw-scale-[0.98] tw-transition-transform"
          />
        ) : (
          <div className="tw-absolute tw-inset-0 tw-animate-pulse tw-bg-stone-200" />
        )}
        {needsTags && (
          <span className="tw-absolute tw-top-1.5 tw-left-1.5 tw-rounded-full tw-bg-amber-400 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-amber-950 tw-shadow-sm">
            Needs tags
          </span>
        )}
      </div>
      <p className="tw-mt-1.5 tw-truncate tw-text-xs tw-text-stone-600 tw-capitalize">{label}</p>
    </button>
  )
}
