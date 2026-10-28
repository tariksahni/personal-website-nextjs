import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { localDate } from 'Lib/wardrobe/api'
import { getSuggestions, getWearLog, logWear } from 'Lib/wardrobe/data'
import { startJob, pollJob, rememberJob, forgetJob, recallJob } from 'Lib/wardrobe/jobs'
import OutfitCard from './OutfitCard'
import BuildAround from './BuildAround'
import TryOnSheet from './TryOnSheet'
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, CARD, INPUT, Spinner, ErrorBanner, Notice, SectionTitle, StylistWorking } from './ui'

const SECTIONS = [
  { id: 'office', title: 'Office' },
  { id: 'special', title: 'Special day' },
]

const REQUEST_KEY = 'wardrobe.request'
const MAX_REQUEST = 500
const MAX_AVOID = 30
const RESUMABLE = ['office', 'special', 'request']
// Dark text on white, set inline so global/iOS autofill styles can't make it invisible.
const INPUT_STYLE = { color: '#1c1917', WebkitTextFillColor: '#1c1917', backgroundColor: '#fff' }

function loadRequestState(date) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(REQUEST_KEY) || 'null')
    if (saved && saved.date === date) return saved
  } catch (e) {
    // storage unavailable
  }
  return null
}

function saveRequestState(state) {
  try {
    if (state) window.sessionStorage.setItem(REQUEST_KEY, JSON.stringify(state))
    else window.sessionStorage.removeItem(REQUEST_KEY)
  } catch (e) {
    // storage unavailable
  }
}

function sameIds(a, b) {
  if (!a || !b || a.length !== b.length) return false
  const s = new Set(a)
  return b.every((id) => s.has(id))
}

export default function TodayTab({ items, urls, itemsLoading, onGoToCloset, onGoToMe, anchor, setAnchor }) {
  const [date, setDate] = useState(() => localDate())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [suggestions, setSuggestions] = useState({}) // occasion -> payload
  const [pending, setPending] = useState({}) // slot ('office' | 'special' | 'request') -> started-at ms
  const [errors, setErrors] = useState({}) // slot -> message
  const [requestText, setRequestText] = useState('')
  const [requestResult, setRequestResult] = useState(null) // { request, payload }
  const mounted = useRef(true)
  const [wearLog, setWearLog] = useState(null)
  const [wearing, setWearing] = useState(null) // "occasion:index"
  const [wearError, setWearError] = useState(null)
  const [specialNote, setSpecialNote] = useState('')
  const [showSpecial, setShowSpecial] = useState(false)
  const [includeJacket, setIncludeJacket] = useState(false)

  // Remember the jacket choice on this device (best effort).
  useEffect(() => {
    try {
      if (window.localStorage.getItem('wardrobe.includeJacket') === '1') setIncludeJacket(true)
    } catch (e) {
      // storage unavailable
    }
  }, [])
  const toggleJacket = () => {
    setIncludeJacket((v) => {
      try {
        window.localStorage.setItem('wardrobe.includeJacket', v ? '0' : '1')
      } catch (e) {
        // storage unavailable
      }
      return !v
    })
  }
  const [tryOn, setTryOn] = useState(null) // { outfit, itemIds }

  const itemsById = useMemo(() => {
    const m = {}
    items.forEach((it) => {
      m[it.id] = it
    })
    return m
  }, [items])

  const hasTop = items.some((it) => it.category === 'top')
  const hasBottom = items.some((it) => it.category === 'bottom')
  const closetReady = hasTop && hasBottom

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([getSuggestions(date), getWearLog(date)])
      .then(([s, log]) => {
        setSuggestions(s)
        setWearLog(log)
        if (s.special && s.special.specialNote) setSpecialNote(s.special.specialNote)
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(load, [load])

  // If the app stays open past midnight, roll over to the new day when it becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const today = localDate()
        setDate((d) => (d === today ? d : today))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false // in-flight polls stop; the jobs are resumed on the next mount
    }
  }, [])

  // Restore this tab session's request text + results for today.
  useEffect(() => {
    const saved = loadRequestState(date)
    if (saved) {
      setRequestText(saved.text || '')
      if (saved.payload) setRequestResult({ request: saved.payload.request, payload: saved.payload })
    }
  }, [date])

  const onDone = useCallback(
    (slot, result) => {
      if (slot === 'request') {
        setRequestResult({ request: result.request, payload: result })
        const prev = loadRequestState(date) || {}
        saveRequestState({ ...prev, date, payload: result })
      } else {
        setSuggestions((s) => ({ ...s, [slot]: result }))
      }
    },
    [date]
  )

  const follow = useCallback(
    async (slot, jobId, since) => {
      setPending((p) => ({ ...p, [slot]: since }))
      setErrors((e) => ({ ...e, [slot]: null }))
      try {
        const result = await pollJob(jobId, { isCancelled: () => !mounted.current })
        if (result === null) return // unmounted: resumed on the next mount
        forgetJob(slot)
        if (mounted.current) onDone(slot, result)
      } catch (e) {
        forgetJob(slot)
        if (mounted.current) setErrors((x) => ({ ...x, [slot]: e.message }))
      } finally {
        if (mounted.current) setPending((p) => ({ ...p, [slot]: null }))
      }
    },
    [onDone]
  )

  // Resume jobs that were still running when the tab was switched or the page reloaded.
  useEffect(() => {
    RESUMABLE.forEach((slot) => {
      const saved = recallJob(slot)
      if (saved && saved.meta && saved.meta.date === date) follow(slot, saved.jobId, saved.meta.since || saved.at)
    })
  }, [date, follow])

  const run = async (slot, params) => {
    const since = Date.now()
    setPending((p) => ({ ...p, [slot]: since }))
    setErrors((e) => ({ ...e, [slot]: null }))
    let jobId
    try {
      jobId = await startJob('suggest', { date, includeJacket, ...params })
    } catch (e) {
      if (mounted.current) {
        setErrors((x) => ({ ...x, [slot]: e.message }))
        setPending((p) => ({ ...p, [slot]: null }))
      }
      return
    }
    rememberJob(slot, jobId, { date, since })
    follow(slot, jobId, since)
  }

  const suggestBoth = () => run('office', { mode: 'office' })

  const submitSpecial = (e) => {
    e.preventDefault()
    const note = specialNote.trim()
    if (!note) return
    run('special', { mode: 'special', specialNote: note.slice(0, 300) })
  }

  const askStylist = (request, avoid) => {
    const text = (request || '').trim().slice(0, MAX_REQUEST)
    if (!text) return
    const params = { mode: 'request', request: text }
    if (avoid && avoid.length) params.avoid = avoid.slice(0, MAX_AVOID)
    run('request', params)
  }
  const submitRequest = (e) => {
    e.preventDefault()
    saveRequestState({ ...(loadRequestState(date) || {}), date, text: requestText })
    askStylist(requestText)
  }
  const refreshRequest = () => {
    if (!requestResult) return
    const avoid = ((requestResult.payload && requestResult.payload.outfits) || []).map((o) => o.item_ids || []).filter((ids) => ids.length)
    askStylist(requestResult.request, avoid)
  }
  const clearRequest = () => {
    setRequestResult(null)
    setRequestText('')
    setErrors((x) => ({ ...x, request: null }))
    saveRequestState(null)
  }

  const wear = async (occasion, outfit, index, key = `${occasion}:${index}`) => {
    setWearing(key)
    setWearError(null)
    try {
      const ids = (outfit.item_ids || []).filter((id) => itemsById[id])
      const row = await logWear({ date, occasion, outfit: { ...outfit, item_ids: ids } })
      setWearLog(row)
    } catch (e) {
      setWearError(e.message)
    } finally {
      setWearing(null)
    }
  }

  const hasMain = !!suggestions.office
  const mainPending = !!pending.office
  const requestPending = !!pending.request
  const prettyDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (loading || itemsLoading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-16">
        <Spinner className="tw-w-7 tw-h-7" />
      </div>
    )
  }
  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />

  return (
    <div className="tw-space-y-6">
      <div>
        <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-stone-400">{prettyDate}</p>
        <h2 className="tw-m-0 tw-mt-1 tw-font-serif tw-text-[28px] tw-font-normal tw-leading-tight tw-text-stone-900">
          What to wear today
        </h2>
        {wearLog && wearLog.outfit && wearLog.outfit.name && (
          <div className="tw-mt-2 tw-flex tw-items-center tw-gap-3">
            <p className="tw-text-sm tw-text-emerald-700">✓ Logged: {wearLog.outfit.name}</p>
            {(wearLog.item_ids || []).some((x) => itemsById[x]) && (
              <button
                type="button"
                onClick={() => setTryOn({ outfit: wearLog.outfit, itemIds: wearLog.item_ids.filter((x) => itemsById[x]) })}
                className="tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-text-sm tw-font-medium tw-text-stone-900 tw-underline tw-cursor-pointer"
              >
                Try it on
              </button>
            )}
          </div>
        )}
      </div>

      {!closetReady && (
        <div className="tw-rounded-2xl tw-border tw-border-dashed tw-border-stone-300 tw-px-5 tw-py-6 tw-text-center">
          <p className="tw-font-serif tw-text-lg tw-text-stone-900">
            {items.length === 0 ? 'Start with your closet' : 'Almost there'}
          </p>
          <p className="tw-mt-1.5 tw-text-sm tw-leading-relaxed tw-text-stone-500">
            Suggestions need at least one tagged top and one tagged bottom
            {items.length > 0 ? ` — you're missing ${!hasTop && !hasBottom ? 'both' : !hasTop ? 'a top' : 'a bottom'}` : ''}. Shoes help too.
          </p>
          <button type="button" onClick={onGoToCloset} className={`${BTN_PRIMARY} tw-mt-4`}>
            Go to Closet
          </button>
        </div>
      )}

      {closetReady && (
        <section className={`${CARD} tw-p-4`}>
          <form onSubmit={submitRequest} className="tw-space-y-3">
            <label htmlFor="wd-request" className="tw-block tw-font-serif tw-text-lg tw-text-stone-900">
              Ask your stylist
            </label>
            <textarea
              id="wd-request"
              rows={3}
              value={requestText}
              maxLength={MAX_REQUEST}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="e.g. something light for a long meeting, no jeans, use my olive overshirt"
              className={`${INPUT} tw-resize-none`}
              style={INPUT_STYLE}
            />
            <div className="tw-flex tw-items-center tw-gap-3">
              <button type="submit" disabled={requestPending || !requestText.trim()} className={`${BTN_PRIMARY} tw-flex-1`}>
                {requestPending ? <Spinner light className="tw-w-4 tw-h-4" /> : <span aria-hidden>✦</span>}
                {requestPending ? 'Styling…' : 'Suggest 7 outfits'}
              </button>
              {requestText.length > MAX_REQUEST - 80 && (
                <span className="tw-shrink-0 tw-text-xs tw-text-stone-400">{MAX_REQUEST - requestText.length}</span>
              )}
            </div>
          </form>
        </section>
      )}

      {(requestPending || requestResult || errors.request) && (
        <section>
          <SectionTitle
            right={
              requestResult && (
                <div className="tw-flex tw-gap-1">
                  <button type="button" onClick={refreshRequest} disabled={requestPending} className={`${BTN_GHOST} tw-min-h-[36px] tw-px-2.5 tw-text-sm`}>
                    ↻ Refresh
                  </button>
                  <button type="button" onClick={clearRequest} disabled={requestPending} className={`${BTN_GHOST} tw-min-h-[36px] tw-px-2.5 tw-text-sm`}>
                    Clear
                  </button>
                </div>
              )
            }
          >
            For your request
          </SectionTitle>
          {requestResult && requestResult.request && (
            <p className="tw-mb-3 -tw-mt-2 tw-text-sm tw-italic tw-text-stone-500">“{requestResult.request}”</p>
          )}
          <div className="tw-space-y-3">
            {requestPending && <StylistWorking since={pending.request} />}
            {errors.request && (
              <ErrorBanner
                message={errors.request}
                onRetry={requestPending ? undefined : () => (requestResult ? refreshRequest() : askStylist(requestText))}
              />
            )}
            {requestResult && requestResult.payload && requestResult.payload.note && <Notice>{requestResult.payload.note}</Notice>}
            <div className={`tw-space-y-3 ${requestPending ? 'tw-opacity-60 tw-transition-opacity' : 'tw-transition-opacity'}`}>
              {requestResult &&
                ((requestResult.payload && requestResult.payload.outfits) || []).map((outfit, i) => (
                  <OutfitCard
                    key={`request-${(outfit.item_ids || []).join('-')}`}
                    outfit={outfit}
                    itemsById={itemsById}
                    urls={urls}
                    worn={!!wearLog && sameIds(wearLog.item_ids, (outfit.item_ids || []).filter((x) => itemsById[x]))}
                    wornOther={!!wearLog}
                    busy={wearing === `request:${i}`}
                    disabled={!!wearing}
                    onWear={() => wear('office', outfit, i, `request:${i}`)}
                    onTryOn={(itemIds) => setTryOn({ outfit, itemIds })}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      {closetReady && (
        <div className="tw-grid tw-grid-cols-1 tw-gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={includeJacket}
            onClick={toggleJacket}
            className="tw-flex tw-w-full tw-min-h-[44px] tw-items-center tw-justify-between tw-m-0 tw-px-1 tw-py-0 tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-text-left tw-cursor-pointer"
          >
            <span className="tw-text-[15px] tw-text-stone-800">Include a jacket</span>
            <span
              aria-hidden
              className={`tw-relative tw-inline-block tw-h-7 tw-w-12 tw-rounded-full tw-transition-colors ${includeJacket ? 'tw-bg-stone-900' : 'tw-bg-stone-300'}`}
            >
              <span
                className={`tw-absolute tw-top-0.5 tw-h-6 tw-w-6 tw-rounded-full tw-bg-white tw-shadow tw-transition-all ${includeJacket ? 'tw-left-[22px]' : 'tw-left-0.5'}`}
              />
            </span>
          </button>
          <button type="button" onClick={suggestBoth} disabled={mainPending} className={`${hasMain ? BTN_SECONDARY : BTN_PRIMARY} tw-w-full`}>
            {mainPending ? <Spinner light={!hasMain} className="tw-w-4 tw-h-4" /> : <span aria-hidden>{hasMain ? '↻' : '✦'}</span>}
            {mainPending ? 'Styling…' : hasMain ? 'Refresh — show new outfits' : 'Suggest office outfits'}
          </button>
          {mainPending && <StylistWorking since={pending.office} />}
        </div>
      )}

      <ErrorBanner message={wearError} onDismiss={() => setWearError(null)} />

      {SECTIONS.filter((s) => s.id !== 'special').map(({ id, title }) => {
        const payload = suggestions[id]
        if (!payload && !errors[id]) return null
        return (
          <OccasionSection
            key={id}
            title={title}
            payload={payload}
            error={errors[id]}
            pending={!!pending[id]}
            onRetry={() => run(id, { mode: id })}
            renderOutfit={(outfit, i) => (
              <OutfitCard
                key={`${id}-${i}`}
                outfit={outfit}
                itemsById={itemsById}
                urls={urls}
                worn={!!wearLog && sameIds(wearLog.item_ids, (outfit.item_ids || []).filter((x) => itemsById[x]))}
                wornOther={!!wearLog}
                busy={wearing === `${id}:${i}`}
                disabled={!!wearing}
                onWear={() => wear(id, outfit, i)}
                onTryOn={(itemIds) => setTryOn({ outfit, itemIds })}
              />
            )}
          />
        )
      })}

      {closetReady && setAnchor && (
        <BuildAround
          items={items}
          urls={urls}
          itemsById={itemsById}
          anchor={anchor}
          setAnchor={setAnchor}
          date={date}
          includeJacket={includeJacket}
          wearLog={wearLog}
          wearing={wearing}
          onWear={(outfit, i) => wear('office', outfit, i, `anchor:${i}`)}
          onTryOn={setTryOn}
        />
      )}

      {closetReady && (
        <section className="tw-rounded-2xl tw-bg-stone-900 tw-p-4 tw-text-white">
          {!showSpecial && !suggestions.special ? (
            <button
              type="button"
              onClick={() => setShowSpecial(true)}
              className="tw-flex tw-w-full tw-min-h-[44px] tw-items-center tw-justify-between tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-text-left tw-text-white tw-cursor-pointer"
            >
              <span>
                <span className="tw-block tw-font-serif tw-text-lg">Special day?</span>
                <span className="tw-block tw-text-sm tw-text-stone-300">Wedding, date, interview, travel…</span>
              </span>
              <span aria-hidden className="tw-text-2xl tw-text-stone-400">→</span>
            </button>
          ) : (
            <form onSubmit={submitSpecial} className="tw-space-y-3">
              <label htmlFor="wd-special" className="tw-block tw-font-serif tw-text-lg">
                What&apos;s the occasion?
              </label>
              <input
                id="wd-special"
                value={specialNote}
                maxLength={300}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="e.g. friend's beach wedding, evening"
                className={INPUT}
                style={{ color: '#1c1917', WebkitTextFillColor: '#1c1917', backgroundColor: '#fff' }}
              />
              <button
                type="submit"
                disabled={!!pending.special || !specialNote.trim()}
                className="tw-inline-flex tw-w-full tw-min-h-[44px] tw-items-center tw-justify-center tw-gap-2 tw-m-0 tw-rounded-xl tw-border-0 tw-bg-white active:tw-bg-stone-200 focus:tw-border-0 tw-text-[15px] tw-font-medium tw-text-stone-900 tw-cursor-pointer disabled:tw-opacity-50"
              >
                {pending.special ? <Spinner className="tw-w-4 tw-h-4" /> : null}
                {pending.special ? 'Styling…' : suggestions.special ? 'Suggest again' : 'Suggest outfits'}
              </button>
              {pending.special && (
                <p className="tw-m-0 tw-text-center tw-text-xs tw-text-stone-300">Your stylist is looking at your closet… (30–90s)</p>
              )}
            </form>
          )}
        </section>
      )}

      {(suggestions.special || errors.special) && (
        <OccasionSection
          title="Special day"
          subtitle={suggestions.special && suggestions.special.specialNote}
          payload={suggestions.special}
          error={errors.special}
          pending={!!pending.special}
          renderOutfit={(outfit, i) => (
            <OutfitCard
              key={`special-${i}`}
              outfit={outfit}
              itemsById={itemsById}
              urls={urls}
              worn={!!wearLog && sameIds(wearLog.item_ids, (outfit.item_ids || []).filter((x) => itemsById[x]))}
              wornOther={!!wearLog}
              busy={wearing === `special:${i}`}
              disabled={!!wearing}
              onWear={() => wear('special', outfit, i)}
              onTryOn={(itemIds) => setTryOn({ outfit, itemIds })}
            />
          )}
        />
      )}

      {tryOn && (
        <TryOnSheet
          outfit={tryOn.outfit}
          itemIds={tryOn.itemIds}
          onClose={() => setTryOn(null)}
          onGoToMe={onGoToMe || (() => {})}
        />
      )}
    </div>
  )
}

function OccasionSection({ title, subtitle, payload, error, pending, onRetry, renderOutfit }) {
  const outfits = (payload && payload.outfits) || []
  return (
    <section className={pending ? 'tw-opacity-60 tw-transition-opacity' : 'tw-transition-opacity'}>
      <SectionTitle right={pending ? <Spinner className="tw-w-4 tw-h-4" /> : null}>{title}</SectionTitle>
      {subtitle && <p className="tw-mb-3 -tw-mt-2 tw-text-sm tw-italic tw-text-stone-500">“{subtitle}”</p>}
      <div className="tw-space-y-3">
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {payload && payload.cooldownRelaxed && (
          <Notice>Not enough fresh tops, so some worn in the last 4 days are included.</Notice>
        )}
        {outfits.map((o, i) => renderOutfit(o, i))}
      </div>
    </section>
  )
}
