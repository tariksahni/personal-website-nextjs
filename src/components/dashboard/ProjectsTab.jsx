import { useState, useEffect, useMemo } from 'react'
import { supabase } from 'Lib/supabase'
import { STAGES } from 'Lib/projectDefaults'
import ProjectDetail from 'Components/dashboard/ProjectDetail'
import CreateProject from 'Components/dashboard/CreateProject'

const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"

const PRIORITIES = ['urgent', 'high', 'normal', 'low']
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 }

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StageBadge({ stage }) {
  const stageObj = STAGES.find((s) => s.id === stage)
  const label = stageObj?.label || stage
  const isLive = stage === 'live'
  return (
    <span
      className={`tw-inline-flex tw-items-center tw-px-2.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-border ${
        isLive
          ? 'tw-bg-okaygreen-500/10 tw-text-okaygreen-500 tw-border-okaygreen-500/20'
          : 'tw-bg-purps-500/10 tw-text-purps-500 tw-border-purps-500/20'
      }`}
    >
      {label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const config = {
    urgent: { classes: 'tw-bg-warningred-500/10 tw-text-warningred-500 tw-border-warningred-500/20', label: 'Urgent' },
    high: { classes: 'tw-bg-candy-500/10 tw-text-candy-500 tw-border-candy-500/20', label: 'High' },
    normal: { classes: 'tw-bg-grey-100 tw-text-grey-500 tw-border-grey-200', label: 'Normal' },
    low: { classes: 'tw-bg-grey-50 tw-text-grey-400 tw-border-grey-200', label: 'Low' },
  }
  const c = config[priority] || config.normal
  return (
    <span className={`tw-inline-flex tw-items-center tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-border ${c.classes}`}>
      {c.label}
    </span>
  )
}

function ProgressBar({ checked, total }) {
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  return (
    <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-[120px]">
      <div className="tw-flex-1 tw-h-1.5 tw-bg-grey-100 tw-rounded-full tw-overflow-hidden">
        <div
          className={`tw-h-full tw-rounded-full tw-transition-all ${
            pct === 100 ? 'tw-bg-okaygreen-500' : 'tw-bg-purps-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tw-text-xs tw-text-grey-400 tw-tabular-nums tw-whitespace-nowrap">
        {checked}/{total}
      </span>
    </div>
  )
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState([])
  const [checklistMap, setChecklistMap] = useState({})
  const [loading, setLoading] = useState(true)

  const [filterTeam, setFilterTeam] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [sortBy, setSortBy] = useState('updated')

  const [selectedProject, setSelectedProject] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const [projectsRes, checklistRes, teamsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*, teams(name)')
        .order('updated_at', { ascending: false }),
      supabase
        .from('project_checklist')
        .select('project_id, stage, is_checked'),
      supabase
        .from('teams')
        .select('id, name')
        .order('name'),
    ])

    setProjects(projectsRes.data || [])
    setTeams(teamsRes.data || [])

    const map = {}
    for (const item of checklistRes.data || []) {
      const key = `${item.project_id}::${item.stage}`
      if (!map[key]) map[key] = { checked: 0, total: 0 }
      map[key].total += 1
      if (item.is_checked) map[key].checked += 1
    }
    setChecklistMap(map)

    setLoading(false)
  }

  function refetchProjects() {
    fetchData()
  }

  function getProgress(projectId, stage) {
    const key = `${projectId}::${stage}`
    return checklistMap[key] || { checked: 0, total: 0 }
  }

  const filtered = useMemo(() => {
    let result = [...projects]

    if (filterTeam) {
      result = result.filter((p) => p.team_id === filterTeam)
    }
    if (filterStage) {
      result = result.filter((p) => p.stage === filterStage)
    }
    if (filterPriority) {
      result = result.filter((p) => p.priority === filterPriority)
    }

    if (sortBy === 'priority') {
      result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else {
      result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }

    return result
  }, [projects, filterTeam, filterStage, filterPriority, sortBy])

  if (loading) {
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-py-24">
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-3">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
          <p className="tw-text-grey-500 tw-text-sm">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <div>
          <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900">Projects</h2>
          <p className="tw-text-sm tw-text-grey-500 tw-mt-0.5">
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
            {(filterTeam || filterStage || filterPriority) && projects.length !== filtered.length
              ? ` of ${projects.length}`
              : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className={btnPrimary + " tw-flex tw-items-center tw-gap-1.5 tw-shadow-sm"}
        >
          <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </button>
      </div>

      {/* Filter bar */}
      {projects.length > 0 && (
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-mb-5">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <div className="tw-ml-auto tw-flex tw-items-center tw-gap-1.5">
            <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
            >
              <option value="updated">Updated</option>
              <option value="priority">Priority</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-24">
          <div className="tw-w-14 tw-h-14 tw-bg-white tw-border tw-border-grey-200 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-mb-5 tw-shadow-sm">
            <svg className="tw-w-6 tw-h-6 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <p className="tw-text-grey-700 tw-text-sm tw-mb-1">No projects yet</p>
          <p className="tw-text-grey-500 tw-text-sm">Create your first project to start tracking.</p>
        </div>
      )}

      {/* Filtered empty state */}
      {projects.length > 0 && filtered.length === 0 && (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
          <p className="tw-text-grey-500 tw-text-sm">No projects match the current filters.</p>
          <button
            onClick={() => { setFilterTeam(''); setFilterStage(''); setFilterPriority('') }}
            className="tw-text-purps-500 hover:tw-text-purps-600 tw-text-sm tw-font-medium tw-mt-2 tw-transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Project list */}
      {filtered.length > 0 && (
        <div className="tw-space-y-2">
          {filtered.map((project) => {
            const progress = getProgress(project.id, project.stage)
            const teamName = project.teams?.name
            return (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="tw-bg-white tw-border tw-border-grey-200 tw-rounded-xl tw-px-5 tw-py-4 tw-cursor-pointer tw-transition-all hover:tw-border-grey-300 hover:tw-shadow-md tw-group"
              >
                <div className="tw-flex tw-items-center tw-gap-4">
                  {/* Name and team */}
                  <div className="tw-flex-1 tw-min-w-0">
                    <div className="tw-flex tw-items-center tw-gap-2.5">
                      <h3 className="tw-text-sm tw-font-semibold tw-text-grey-900 tw-truncate">
                        {project.name}
                      </h3>
                      <PriorityBadge priority={project.priority} />
                    </div>
                    {teamName && (
                      <p className="tw-text-xs tw-text-grey-400 tw-mt-0.5 tw-truncate">{teamName}</p>
                    )}
                  </div>

                  {/* Stage */}
                  <div className="tw-flex-shrink-0">
                    <StageBadge stage={project.stage} />
                  </div>

                  {/* Progress */}
                  <div className="tw-flex-shrink-0 tw-hidden sm:tw-block">
                    <ProgressBar checked={progress.checked} total={progress.total} />
                  </div>

                  {/* Updated */}
                  <div className="tw-flex-shrink-0 tw-text-right tw-hidden md:tw-block">
                    <span className="tw-text-xs tw-text-grey-400">
                      {project.updated_at ? timeAgo(project.updated_at) : '---'}
                    </span>
                  </div>

                  {/* Chevron */}
                  <div className="tw-flex-shrink-0 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
                    <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create project modal */}
      <CreateProject
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onCreated={refetchProjects}
      />

      {/* Project detail slide-out */}
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onProjectUpdated={refetchProjects}
        />
      )}
    </div>
  )
}
