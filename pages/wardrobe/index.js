import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useAuth } from 'Hooks/useAuth'
import { listItems } from 'Lib/wardrobe/data'
import TodayTab from 'Components/wardrobe/TodayTab'
import ClosetTab from 'Components/wardrobe/ClosetTab'
import MeTab from 'Components/wardrobe/MeTab'
import { useSignedUrls } from 'Components/wardrobe/useSignedUrls'
import { ErrorBanner, Spinner } from 'Components/wardrobe/ui'

const THEME_COLOR = '#fafaf9'

const TABS = [
  {
    id: 'today',
    label: 'Today',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  },
  {
    id: 'closet',
    label: 'Closet',
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  },
  {
    id: 'me',
    label: 'Me',
    icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  },
]

function WardrobeHead() {
  return (
    <Head>
      <title>Wardrobe</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <link rel="manifest" href="/wardrobe.webmanifest" />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Wardrobe" />
      <link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png" />
    </Head>
  )
}

export default function Wardrobe() {
  const { user, loading, logout } = useAuth({ redirectTo: '/login?next=/wardrobe' })
  const [tab, setTab] = useState('today')
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState(null)
  const urls = useSignedUrls(items)
  const userId = user ? user.id : null

  const loadItems = useCallback(() => {
    setItemsLoading(true)
    setItemsError(null)
    listItems()
      .then(setItems)
      .catch((e) => setItemsError(e.message))
      .finally(() => setItemsLoading(false))
  }, [])

  useEffect(() => {
    if (userId) loadItems()
  }, [userId, loadItems])

  const selectTab = (id) => {
    setTab(id)
    if (typeof window !== 'undefined') window.scrollTo(0, 0)
  }

  if (loading || !user) {
    return (
      <div className="wardrobe-root tw-min-h-screen tw-bg-stone-50 tw-flex tw-items-center tw-justify-center">
        <WardrobeHead />
        {loading ? <Spinner className="tw-w-7 tw-h-7" /> : null}
      </div>
    )
  }

  return (
    <div className="wardrobe-root tw-min-h-screen tw-bg-stone-50 tw-text-stone-900 tw-leading-normal tw-antialiased">
      <WardrobeHead />

      <header
        className="tw-sticky tw-top-0 tw-z-20 tw-border-0 tw-border-b tw-border-solid tw-border-stone-200/70 tw-bg-stone-50/90 tw-backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="tw-mx-auto tw-flex tw-h-14 tw-max-w-md tw-items-center tw-justify-between tw-px-4">
          <h1 className="tw-m-0 tw-font-serif tw-text-[22px] tw-font-normal tw-italic tw-tracking-tight tw-text-stone-900">
            Wardrobe
          </h1>
          <button
            type="button"
            onClick={logout}
            className="tw-m-0 tw-min-h-[44px] tw-px-2 -tw-mr-2 tw-border-0 tw-bg-transparent active:tw-bg-transparent focus:tw-border-0 tw-text-sm tw-text-stone-500 active:tw-text-stone-900 tw-cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      <main
        className="tw-mx-auto tw-max-w-md tw-px-4 tw-pt-5"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >
        {itemsError && (
          <div className="tw-mb-4">
            <ErrorBanner message={itemsError} onRetry={loadItems} />
          </div>
        )}
        {tab === 'today' && (
          <TodayTab items={items} urls={urls} itemsLoading={itemsLoading} onGoToCloset={() => selectTab('closet')} onGoToMe={() => selectTab('me')} />
        )}
        {tab === 'closet' && (
          <ClosetTab items={items} urls={urls} loading={itemsLoading} onItemsChange={setItems} />
        )}
        {tab === 'me' && <MeTab />}
      </main>

      <nav
        aria-label="Wardrobe sections"
        className="tw-fixed tw-inset-x-0 tw-bottom-0 tw-z-30 tw-border-0 tw-border-t tw-border-solid tw-border-stone-200 tw-bg-white/95 tw-backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="tw-mx-auto tw-grid tw-max-w-md tw-grid-cols-3">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`tw-flex tw-h-16 tw-flex-col tw-items-center tw-justify-center tw-gap-1 tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent active:tw-bg-stone-50 focus:tw-border-0 tw-cursor-pointer tw-text-[11px] tw-font-medium tw-tracking-wide ${
                  on ? 'tw-text-stone-900' : 'tw-text-stone-400'
                }`}
              >
                <svg aria-hidden className="tw-w-6 tw-h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={on ? 2 : 1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
                <span className={`tw-h-1 tw-w-1 tw-rounded-full ${on ? 'tw-bg-stone-900' : 'tw-bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
