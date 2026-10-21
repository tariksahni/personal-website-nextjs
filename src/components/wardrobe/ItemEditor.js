import { useEffect, useState } from 'react'
import { CATEGORIES, FORMALITY, SEASONS, updateItem, deleteItem, downloadImage } from 'Lib/wardrobe/data'
import { callFn } from 'Lib/wardrobe/api'
import { resizeImage } from 'Lib/wardrobe/image'
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_GHOST,
  INPUT,
  LABEL,
  Spinner,
  ErrorBanner,
  Select,
  CATEGORY_LABEL,
  FORMALITY_LABEL,
} from './ui'

function toForm(item) {
  return {
    category: item.category || '',
    subcategory: item.subcategory || '',
    colors: (item.colors || []).join(', '),
    pattern: item.pattern || '',
    formality: item.formality || '',
    seasons: item.seasons || [],
    description: item.description || '',
  }
}

function fromForm(form) {
  const clean = (s) => (s && s.trim() ? s.trim() : null)
  return {
    category: form.category || null,
    subcategory: clean(form.subcategory),
    colors: form.colors
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6),
    pattern: clean(form.pattern),
    formality: form.formality || null,
    seasons: SEASONS.filter((s) => form.seasons.includes(s)),
    description: clean(form.description),
  }
}

/** Bottom-sheet editor for a single closet item. */
export default function ItemEditor({ item, url, onClose, onSaved, onDeleted, onStyle }) {
  const [form, setForm] = useState(() => toForm(item))
  const [busy, setBusy] = useState(null) // 'save' | 'delete' | 'tag'
  const [error, setError] = useState(null)

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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleSeason = (s) =>
    setForm((f) => ({
      ...f,
      seasons: f.seasons.includes(s) ? f.seasons.filter((x) => x !== s) : [...f.seasons, s],
    }))

  const save = async () => {
    setBusy('save')
    setError(null)
    try {
      const updated = await updateItem(item.id, fromForm(form))
      onSaved(updated)
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this item from your closet?')) return
    setBusy('delete')
    setError(null)
    try {
      await deleteItem(item)
      onDeleted(item.id)
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  const autoTag = async () => {
    setBusy('tag')
    setError(null)
    try {
      const blob = await downloadImage(item.image_path)
      const { base64, mediaType } = await resizeImage(blob)
      const { tags } = await callFn('wardrobe-tag', { imageBase64: base64, mediaType })
      // Keep existing colours (often fixed by hand); use AI colours only if the item has none.
      const keepColors = item.colors && item.colors.length ? { colors: item.colors } : {}
      setForm(toForm({ ...item, ...tags, ...keepColors }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-end tw-justify-center" role="dialog" aria-modal="true" aria-label="Edit item">
      <div className="tw-absolute tw-inset-0 tw-bg-stone-900/50" onClick={busy ? undefined : onClose} />
      <div
        className="tw-relative tw-w-full tw-max-w-md tw-max-h-[92vh] tw-overflow-y-auto tw-rounded-t-3xl tw-bg-stone-50 tw-shadow-2xl"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-items-center tw-justify-between tw-bg-stone-50/95 tw-px-4 tw-pt-2 tw-pb-1 tw-backdrop-blur">
          <span className="tw-w-11" />
          <span className="tw-h-1 tw-w-10 tw-rounded-full tw-bg-stone-300" />
          <button type="button" aria-label="Close" onClick={onClose} disabled={!!busy} className={`${BTN_GHOST} tw-w-11 tw-px-0 tw-text-2xl`}>
            ×
          </button>
        </div>

        <div className="tw-px-4 tw-space-y-4">
          <div className="tw-flex tw-gap-4 tw-items-start">
            <div className="tw-relative tw-w-28 tw-h-28 tw-shrink-0 tw-overflow-hidden tw-rounded-2xl tw-bg-stone-200">
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
              )}
            </div>
            <div className="tw-flex-1 tw-min-w-0 tw-space-y-2">
              <p className="tw-font-serif tw-text-lg tw-leading-tight tw-text-stone-900 tw-capitalize">
                {form.subcategory || CATEGORY_LABEL[form.category] || 'Untagged item'}
              </p>
              <button type="button" onClick={autoTag} disabled={!!busy} className={`${BTN_SECONDARY} tw-w-full`}>
                {busy === 'tag' ? <Spinner className="tw-w-4 tw-h-4" /> : <span aria-hidden>✦</span>}
                {busy === 'tag' ? 'Tagging…' : 'Auto-tag with AI'}
              </button>
            </div>
          </div>

          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {onStyle && item.category && (
            <button type="button" onClick={() => onStyle(item)} disabled={!!busy} className={`${BTN_PRIMARY} tw-w-full`}>
              <span aria-hidden>◎</span> Style this piece
            </button>
          )}

          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <div>
              <label className={LABEL} htmlFor="wd-category">Category</label>
              <Select id="wd-category" value={form.category} onChange={set('category')}>
                <option value="">Needs tags</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className={LABEL} htmlFor="wd-formality">Formality</label>
              <Select id="wd-formality" value={form.formality} onChange={set('formality')}>
                <option value="">—</option>
                {FORMALITY.map((f) => (
                  <option key={f} value={f}>{FORMALITY_LABEL[f]}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="wd-sub">Type</label>
            <input id="wd-sub" value={form.subcategory} onChange={set('subcategory')} placeholder="e.g. oxford shirt" className={INPUT} />
          </div>

          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <div>
              <label className={LABEL} htmlFor="wd-colors">Colours</label>
              <input id="wd-colors" value={form.colors} onChange={set('colors')} placeholder="navy, white" className={INPUT} />
            </div>
            <div>
              <label className={LABEL} htmlFor="wd-pattern">Pattern</label>
              <input id="wd-pattern" value={form.pattern} onChange={set('pattern')} placeholder="solid" className={INPUT} />
            </div>
          </div>

          <div>
            <span className={LABEL}>Seasons</span>
            <div className="tw-flex tw-flex-wrap tw-gap-2">
              {SEASONS.map((s) => {
                const on = form.seasons.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSeason(s)}
                    aria-pressed={on}
                    className={`${on ? BTN_PRIMARY : BTN_SECONDARY} tw-capitalize tw-px-3.5 tw-rounded-full tw-text-sm`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="wd-desc">Description</label>
            <textarea id="wd-desc" rows={2} value={form.description} onChange={set('description')} className={`${INPUT} tw-resize-none`} />
          </div>

          <div className="tw-flex tw-gap-3 tw-pt-1">
            <button type="button" onClick={remove} disabled={!!busy} className={BTN_DANGER}>
              {busy === 'delete' ? <Spinner className="tw-w-4 tw-h-4" /> : 'Delete'}
            </button>
            <button type="button" onClick={save} disabled={!!busy} className={`${BTN_PRIMARY} tw-flex-1`}>
              {busy === 'save' ? <Spinner light className="tw-w-4 tw-h-4" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
