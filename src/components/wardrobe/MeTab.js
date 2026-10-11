import { useEffect, useRef, useState } from 'react'
import { resizeImage } from 'Lib/wardrobe/image'
import { callFn } from 'Lib/wardrobe/api'
import { getProfile, saveProfile } from 'Lib/wardrobe/data'
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, INPUT, LABEL, CARD, Spinner, ErrorBanner, SectionTitle } from './ui'

export default function MeTab() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [notes, setNotes] = useState('')
  const [profileText, setProfileText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [photo, setPhoto] = useState(null) // { file, preview }
  const [busy, setBusy] = useState(null) // 'generate' | 'save'
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const fileRef = useRef(null)

  const load = () => {
    setLoading(true)
    setLoadError(null)
    getProfile()
      .then((p) => {
        setNotes((p && p.notes) || '')
        setSavedNotes((p && p.notes) || '')
        setProfileText((p && p.profile_text) || '')
        setSavedText((p && p.profile_text) || '')
        setUpdatedAt(p ? p.updated_at : null)
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Free the preview object URL when the photo changes / on unmount.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo])

  const pickPhoto = (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  const generate = async () => {
    setBusy('generate')
    setError(null)
    setFlash(null)
    try {
      const body = { notes: notes.trim() }
      if (photo) {
        const { base64, mediaType } = await resizeImage(photo.file)
        body.imageBase64 = base64
        body.mediaType = mediaType
      }
      const res = await callFn('wardrobe-profile', body)
      setProfileText(res.profileText || '')
      setFlash('Draft ready — edit anything, then save.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    setFlash(null)
    try {
      const row = await saveProfile({ profileText: profileText.trim(), notes: notes.trim() })
      setSavedText(row.profile_text || '')
      setSavedNotes(row.notes || '')
      setUpdatedAt(row.updated_at)
      setFlash('Saved. New suggestions will use this profile.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-16">
        <Spinner className="tw-w-7 tw-h-7" />
      </div>
    )
  }
  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />

  const dirty = profileText.trim() !== (savedText || '').trim() || notes.trim() !== (savedNotes || '').trim()
  const canGenerate = !!photo || !!notes.trim()

  return (
    <div className="tw-space-y-6">
      <section>
        <SectionTitle>About you</SectionTitle>
        <p className="tw-mb-4 tw-text-sm tw-leading-relaxed tw-text-stone-500">
          A short style profile helps the stylist pick colours and fits that suit you. Add a photo, a few notes, or both.
        </p>

        <div className={`${CARD} tw-p-4 tw-space-y-4`}>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="tw-hidden" />
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-relative tw-w-20 tw-h-20 tw-shrink-0 tw-overflow-hidden tw-rounded-full tw-bg-stone-100 tw-flex tw-items-center tw-justify-center">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.preview} alt="Selected" className="tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-cover" />
              ) : (
                <svg aria-hidden className="tw-w-9 tw-h-9 tw-text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </div>
            <div className="tw-flex-1 tw-min-w-0 tw-space-y-1">
              <div className="tw-flex tw-gap-2">
                <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy} className={`${BTN_SECONDARY} tw-flex-1`}>
                  {photo ? 'Change photo' : 'Add photo'}
                </button>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} disabled={!!busy} className={BTN_GHOST}>
                    Remove
                  </button>
                )}
              </div>
              <p className="tw-text-xs tw-text-stone-500">Optional · full-length, natural light works best</p>
            </div>
          </div>

          <div className="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-bg-emerald-50 tw-px-3 tw-py-2.5 tw-text-xs tw-leading-snug tw-text-emerald-900">
            <span aria-hidden>🔒</span>
            <span>Your photo is not stored. It is only sent once to generate the text below; just the text is saved.</span>
          </div>

          <div>
            <label className={LABEL} htmlFor="wd-notes">Notes</label>
            <textarea
              id="wd-notes"
              rows={3}
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Height, build, colours you love or avoid, dress code at work…"
              className={`${INPUT} tw-resize-none`}
            />
          </div>

          <button type="button" onClick={generate} disabled={!!busy || !canGenerate} className={`${BTN_PRIMARY} tw-w-full`}>
            {busy === 'generate' ? <Spinner light className="tw-w-4 tw-h-4" /> : <span aria-hidden>✦</span>}
            {busy === 'generate' ? 'Analysing…' : savedText ? 'Regenerate profile' : 'Generate profile'}
          </button>
        </div>
      </section>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <section>
        <SectionTitle
          right={
            updatedAt && savedText ? (
              <span className="tw-text-xs tw-text-stone-400">Saved {new Date(updatedAt).toLocaleDateString()}</span>
            ) : null
          }
        >
          Style profile
        </SectionTitle>
        <textarea
          rows={8}
          value={profileText}
          onChange={(e) => setProfileText(e.target.value)}
          placeholder="Generate a profile above, or write your own: colours that suit you, fits you like, things to avoid."
          className={`${INPUT} tw-leading-relaxed`}
          aria-label="Style profile"
        />
        {flash && <p className="tw-mt-2 tw-text-sm tw-text-emerald-700">{flash}</p>}
        <button type="button" onClick={save} disabled={!!busy || !dirty} className={`${BTN_PRIMARY} tw-w-full tw-mt-3`}>
          {busy === 'save' ? <Spinner light className="tw-w-4 tw-h-4" /> : dirty ? 'Save profile' : 'Saved'}
        </button>
      </section>
    </div>
  )
}
