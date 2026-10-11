// TEMP: test image button — remove after dashboard check
// Generates one low-quality, text-only 1024x1024 image through the same try-on start/status
// pipeline, to confirm OpenAI + storage work end-to-end. Delete this file and its use in MeTab.
import { useEffect, useRef, useState } from 'react'
import { deleteLook, generateTestImage } from 'Lib/wardrobe/tryon'
import { BTN_SECONDARY, BTN_DANGER, Spinner, ErrorBanner, SectionTitle } from './ui'

export default function TestImage() {
  const [busy, setBusy] = useState(null) // 'generate' | 'delete'
  const [result, setResult] = useState(null) // { key, url }
  const [error, setError] = useState(null)
  const closed = useRef(false)
  useEffect(
    () => () => {
      closed.current = true
    },
    []
  )

  const run = async () => {
    setBusy('generate')
    setError(null)
    setResult(null)
    try {
      const res = await generateTestImage({ isCancelled: () => closed.current })
      if (!closed.current && res) setResult(res)
    } catch (e) {
      if (!closed.current) setError(e.message)
    } finally {
      if (!closed.current) setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteLook(result.key)
      setResult(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tw-rounded-2xl tw-border tw-border-dashed tw-border-stone-300 tw-p-4">
      <SectionTitle>Test image (temporary)</SectionTitle>
      <p className="tw-mb-3 tw-text-xs tw-text-stone-500">
        One low-quality text-only image (≈ a cent) to check the OpenAI pipeline. No photos are sent.
      </p>
      <button type="button" onClick={run} disabled={!!busy} className={`${BTN_SECONDARY} tw-w-full`}>
        {busy === 'generate' ? <Spinner className="tw-w-4 tw-h-4" /> : null}
        {busy === 'generate' ? 'Generating… (up to a minute)' : 'Test image (temporary)'}
      </button>
      {error && (
        <div className="tw-mt-3">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      {result && (
        <div className="tw-mt-3 tw-space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Test result" className="tw-w-full tw-rounded-xl" />
          <button type="button" onClick={remove} disabled={!!busy} className={`${BTN_DANGER} tw-w-full`}>
            {busy === 'delete' ? <Spinner className="tw-w-4 tw-h-4" /> : null}
            Delete
          </button>
        </div>
      )}
    </section>
  )
}
