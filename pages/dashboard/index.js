import { useState } from 'react'
import { useAuth } from 'Hooks/useAuth'
import TeamsTab from 'Components/dashboard/TeamsTab'
import ProjectsTab from 'Components/dashboard/ProjectsTab'
import TasksTab from 'Components/dashboard/TasksTab'

const TABS = [
  {
    id: 'tasks',
    label: 'My Tasks',
    icon: (
      <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: (
      <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: (
      <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
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
      <header className="tw-bg-white tw-border-b tw-border-grey-200 tw-sticky tw-top-0 tw-z-10 tw-shadow-sm">
        <div className="tw-max-w-7xl tw-mx-auto tw-px-6 tw-py-3 tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-flex tw-items-center tw-justify-center tw-w-8 tw-h-8 tw-bg-purps-500 tw-rounded-lg tw-shadow-sm">
              <svg className="tw-w-4.5 tw-h-4.5 tw-text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="tw-text-base tw-font-semibold tw-text-grey-900">Command Center</h1>
          </div>
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-flex tw-items-center tw-gap-2">
              <div className="tw-w-7 tw-h-7 tw-rounded-full tw-bg-purps-500/10 tw-flex tw-items-center tw-justify-center">
                <svg className="tw-w-3.5 tw-h-3.5 tw-text-purps-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
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
        <div className="tw-max-w-7xl tw-mx-auto tw-px-6 tw-pb-3">
          <nav className="tw-flex tw-gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-flex tw-items-center tw-gap-1.5 tw-rounded-lg ${
                  activeTab === tab.id
                    ? 'tw-bg-purps-500 tw-text-white tw-shadow-sm'
                    : 'tw-text-grey-500 hover:tw-text-grey-700 hover:tw-bg-grey-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="tw-max-w-7xl tw-mx-auto tw-px-6 tw-py-6">
        <div className="tw-bg-white tw-rounded-xl tw-shadow-sm tw-border tw-border-grey-200 tw-p-6">
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'projects' && <ProjectsTab />}
          {activeTab === 'teams' && <TeamsTab />}
        </div>
      </main>
    </div>
  )
}

