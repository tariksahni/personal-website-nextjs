import { useState } from 'react'
import { CATEGORY_LABEL, Spinner } from './ui'

/** Square closet tile with a quick delete button. Shows a "Needs tags" badge when the item has no category. */
export default function ItemCard({ item, url, onClick, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const label = item.subcategory || CATEGORY_LABEL[item.category] || 'Item'
  const needsTags = !item.category

  const remove = async () => {
    if (!window.confirm(`Delete this ${label.toLowerCase()} from your closet?`)) return
    setDeleting(true)
    try {
      await onDelete()
    } catch (e) {
      setDeleting(false)
      window.alert(e.message || 'Could not delete. Please try again.')
    }
  }

  return (
    <div className={`tw-relative ${deleting ? 'tw-opacity-50' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={deleting}
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
      {onDelete && (
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          aria-label={`Delete ${label}`}
          className="tw-absolute tw-top-1 tw-right-1 tw-m-0 tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-full tw-border-0 tw-bg-white/90 tw-p-0 tw-text-sm tw-shadow-sm tw-cursor-pointer active:tw-bg-white"
        >
          {deleting ? <Spinner className="tw-w-3.5 tw-h-3.5" /> : <span aria-hidden>🗑</span>}
        </button>
      )}
    </div>
  )
}
