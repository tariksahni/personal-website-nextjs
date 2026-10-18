import { useEffect, useState } from 'react'
import { deleteLook, listLooks } from 'Lib/wardrobe/tryon'
import LookViewer from './LookViewer'
import { Spinner, ErrorBanner, SectionTitle } from './ui'

/** Me tab: gallery of saved try-on images (from both photos, labelled). */
export default function MyLooks() {
  const [looks, setLooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listLooks()
      .then(setLooks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (look) => {
    await deleteLook(look.key)
    setLooks((prev) => prev.filter((l) => l.key !== look.key))
    setOpen(null)
  }

  return (
    <section>
      <SectionTitle right={loading ? <Spinner className="tw-w-4 tw-h-4" /> : null}>My looks</SectionTitle>
      {error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && looks.length === 0 && (
        <p className="tw-text-sm tw-text-stone-500">Tap “Try it on” on any outfit in Today to see yourself in it.</p>
      )}
      {looks.length > 0 && (
        <div className="tw-grid tw-grid-cols-3 tw-gap-2">
          {looks.map((look) => (
            <button
              key={look.key}
              type="button"
              onClick={() => setOpen(look)}
              aria-label={`Open look (Photo ${look.photo || 1})`}
              className="tw-relative tw-m-0 tw-p-0 tw-aspect-[2/3] tw-overflow-hidden tw-rounded-xl tw-border-0 focus:tw-border-0 tw-bg-stone-100 active:tw-bg-stone-100 tw-cursor-pointer"
            >
              {look.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={look.url} alt="" loading="lazy" className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
              )}
              <span className="tw-absolute tw-left-1.5 tw-bottom-1.5 tw-rounded-full tw-bg-black/60 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-leading-tight tw-text-white">
                Photo {look.photo || 1}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && <LookViewer look={open} onClose={() => setOpen(null)} onDelete={remove} />}
    </section>
  )
}
