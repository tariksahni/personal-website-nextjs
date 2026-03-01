import { useState } from 'react'
import { useAuth } from 'Hooks/useAuth'
import TeamsTab from 'Components/dashboard/TeamsTab'
import ProjectsTab from 'Components/dashboard/ProjectsTab'

const TABS = [
  { id: 'tasks', label: 'My Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'teams', label: 'Teams' },
]

export default function Dashboard() {
  const { user, loading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('tasks')

  if (loading) {
    return (
      <div className="tw-min-h-screen tw-bg-grey-50 tw-flex tw-items-center tw-justify-center">
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-3">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
          <p className="tw-text-grey-500 tw-text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="tw-min-h-screen tw-bg-grey-50" style={{ fontSize: '15px' }}>
      {/* Header */}
      <header className="tw-bg-white tw-border-b tw-border-grey-200 tw-sticky tw-top-0 tw-z-10">
        <div className="tw-max-w-7xl tw-mx-auto tw-px-6 tw-py-3 tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-flex tw-items-center tw-justify-center tw-w-8 tw-h-8 tw-bg-purps-20 tw-border tw-border-purps-50 tw-rounded-lg">
              <span className="tw-text-purps-500 tw-text-xs tw-font-bold">CC</span>
            </div>
            <h1 className="tw-text-base tw-font-semibold tw-text-grey-900">Command Center</h1>
          </div>
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-flex tw-items-center tw-gap-2">
              <div className="tw-w-7 tw-h-7 tw-rounded-full tw-bg-purps-20 tw-flex tw-items-center tw-justify-center">
                <span className="tw-text-purps-600 tw-text-xs tw-font-semibold">
                  {user.email?.[0]?.toUpperCase()}
                </span>
              </div>
              <span className="tw-text-sm tw-text-grey-600 tw-hidden sm:tw-inline">{user.email}</span>
            </div>
            <div className="tw-w-px tw-h-4 tw-bg-grey-200" />
            <button
              onClick={logout}
              className="tw-text-sm tw-text-grey-500 hover:tw-text-grey-700 tw-transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tw-max-w-7xl tw-mx-auto tw-px-6">
          <nav className="tw-flex tw-gap-1 tw--mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tw-relative tw-px-4 tw-py-2.5 tw-text-sm tw-font-medium tw-transition-all ${
                  activeTab === tab.id
                    ? 'tw-text-purps-500'
                    : 'tw-text-grey-500 hover:tw-text-grey-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="tw-absolute tw-bottom-0 tw-left-2 tw-right-2 tw-h-0.5 tw-bg-purps-500 tw-rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="tw-max-w-7xl tw-mx-auto tw-px-6 tw-py-6">
        {activeTab === 'tasks' && (
          <EmptyState title="My Tasks" description="Your personal tasks and project requirements will appear here." />
        )}
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'teams' && <TeamsTab />}
      </main>
    </div>
  )
}

function EmptyState({ title, description }) {
  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-24">
      <div className="tw-w-14 tw-h-14 tw-bg-white tw-border tw-border-grey-200 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-mb-5 tw-shadow-sm">
        <span className="tw-text-grey-400 tw-text-xl">+</span>
      </div>
      <h2 className="tw-text-lg tw-font-medium tw-text-grey-800 tw-mb-1.5">{title}</h2>
      <p className="tw-text-sm tw-text-grey-500 tw-max-w-xs tw-text-center">{description}</p>
    </div>
  )
}
