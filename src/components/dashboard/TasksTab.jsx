import { useState, useEffect, useMemo } from 'react'
import { supabase } from 'Lib/supabase'
import TaskForm from 'Components/dashboard/TaskForm'

const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"

const CATEGORIES = [
  { value: 'reply', label: 'Reply' },
  { value: 'review', label: 'Review' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'decision', label: 'Decision' },
  { value: 'misc', label: 'Misc' },
  { value: 'project_req', label: 'Project' },
]

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 }

const CATEGORY_CONFIG = {
  reply: { classes: 'tw-bg-sky-500/10 tw-text-sky-600 tw-border-sky-500/20', label: 'Reply', border: 'tw-border-l-sky-400',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg> },
  review: { classes: 'tw-bg-purps-500/10 tw-text-purps-500 tw-border-purps-500/20', label: 'Review', border: 'tw-border-l-purps-400',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg> },
  meeting: { classes: 'tw-bg-candy-500/10 tw-text-candy-500 tw-border-candy-500/20', label: 'Meeting', border: 'tw-border-l-candy-400',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg> },
  decision: { classes: 'tw-bg-warningred-500/10 tw-text-warningred-500 tw-border-warningred-500/20', label: 'Decision', border: 'tw-border-l-warningred-400',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg> },
  misc: { classes: 'tw-bg-grey-100 tw-text-grey-500 tw-border-grey-200', label: 'Misc', border: 'tw-border-l-grey-300',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg> },
  project_req: { classes: 'tw-bg-purps-500/10 tw-text-purps-600 tw-border-purps-500/20', label: 'Project', border: 'tw-border-l-purps-400',
    icon: <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg> },
}

function CategoryBadge({ category }) {
  const c = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.misc
  return (
    <span className={`tw-inline-flex tw-items-center tw-gap-1 tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-border ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

function getCategoryBorder(category) {
  return (CATEGORY_CONFIG[category] || CATEGORY_CONFIG.misc).border
}

function PriorityIndicator({ priority }) {
  const config = {
    urgent: 'tw-bg-warningred-500',
    high: 'tw-bg-candy-500',
    normal: 'tw-bg-grey-300',
    low: 'tw-bg-grey-200',
  }
  const cls = config[priority] || config.normal
  return (
    <span
      className={`tw-w-2 tw-h-2 tw-rounded-full tw-flex-shrink-0 ${cls}`}
      title={priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Normal'}
    />
  )
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return due < today
}

function formatDueDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TasksTab() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterNature, setFilterNature] = useState('')
  const [showCompleted, setShowCompleted] = useState(true)
  const [sortBy, setSortBy] = useState('due_date')

  // Quick-add
  const [quickAddTitle, setQuickAddTitle] = useState('')

  // Panels
  const [editingTask, setEditingTask] = useState(null) // null = closed, {} = new, {id:...} = editing
  const [showTaskForm, setShowTaskForm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
      setTasks([])
    } else {
      setTasks(data || [])
    }

    setLoading(false)
  }

  // Quick-add handler
  async function handleQuickAdd(e) {
    e.preventDefault()
    const title = quickAddTitle.trim()
    if (!title) return

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, category: 'misc', priority: 'normal' })
      .select('*, projects(name)')
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return
    }

    setTasks((prev) => [data, ...prev])
    setQuickAddTitle('')
  }

  // Toggle task completion
  async function toggleTask(taskId) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const newDone = !task.is_done
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, is_done: newDone } : t))

    const { error } = await supabase.from('tasks').update({ is_done: newDone }).eq('id', taskId)
    if (error) {
      console.error('Error toggling task:', error)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, is_done: !newDone } : t))
    }
  }

  // Save task from form
  async function handleSaveTask(formData) {
    if (editingTask?.id) {
      // Update existing
      const { data, error } = await supabase
        .from('tasks')
        .update(formData)
        .eq('id', editingTask.id)
        .select('*, projects(name)')
        .single()

      if (error) {
        console.error('Error updating task:', error)
        return
      }

      setTasks((prev) => prev.map((t) => t.id === editingTask.id ? data : t))
    } else {
      // Create new
      const { data, error } = await supabase
        .from('tasks')
        .insert(formData)
        .select('*, projects(name)')
        .single()

      if (error) {
        console.error('Error creating task:', error)
        return
      }

      setTasks((prev) => [data, ...prev])
    }

    setEditingTask(null)
    setShowTaskForm(false)
  }

  // Filtered + sorted tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    if (!showCompleted) {
      result = result.filter((t) => !t.is_done)
    }
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory)
    }
    if (filterPriority) {
      result = result.filter((t) => t.priority === filterPriority)
    }
    if (filterNature === 'personal') {
      result = result.filter((t) => !t.project_id)
    } else if (filterNature === 'project') {
      result = result.filter((t) => !!t.project_id)
    }

    if (sortBy === 'due_date') {
      result.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date) - new Date(b.due_date)
      })
    } else if (sortBy === 'priority') {
      result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    } else if (sortBy === 'created') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    return result
  }, [tasks, filterCategory, filterPriority, filterNature, showCompleted, sortBy])

  if (loading) {
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-py-24">
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-3">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
          <p className="tw-text-grey-500 tw-text-sm">Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <div>
          <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900 tw-flex tw-items-center tw-gap-2">
            <svg className="tw-w-5 tw-h-5 tw-text-purps-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
            </svg>
            My Tasks
          </h2>
          <p className="tw-text-sm tw-text-grey-500 tw-mt-0.5">
            {filteredTasks.filter((t) => !t.is_done).length} open task{filteredTasks.filter((t) => !t.is_done).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditingTask({}); setShowTaskForm(true) }}
          className={btnPrimary + " tw-flex tw-items-center tw-gap-1.5 tw-shadow-sm"}
        >
          <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Task
        </button>
      </div>

      {/* Quick-add bar */}
      <form onSubmit={handleQuickAdd} className="tw-mb-6">
        <div className="tw-flex tw-gap-2">
          <input
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            placeholder="Quick add a task... (press Enter)"
            className={`${inputClass} tw-flex-1`}
          />
        </div>
      </form>

      {/* Filter bar */}
      {tasks.length > 0 && (
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-mb-4">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            <select
              value={filterNature}
              onChange={(e) => setFilterNature(e.target.value)}
              className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
            >
              <option value="">All Tasks</option>
              <option value="personal">Personal</option>
              <option value="project">Project</option>
            </select>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <label className="tw-flex tw-items-center tw-gap-1.5 tw-cursor-pointer tw-select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="tw-rounded tw-border-grey-300 tw-text-purps-500 focus:tw-ring-purps-100"
            />
            <span className="tw-text-xs tw-text-grey-500">Show completed</span>
          </label>

          <div className="tw-ml-auto tw-flex tw-items-center tw-gap-1.5">
            <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={inputClass + " tw-py-1.5 tw-text-xs tw-appearance-none tw-cursor-pointer tw-pr-7"}
            >
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="created">Created</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
          <div className="tw-w-14 tw-h-14 tw-bg-purps-500/5 tw-border tw-border-purps-500/10 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-mb-5">
            <svg className="tw-w-7 tw-h-7 tw-text-purps-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
            </svg>
          </div>
          <p className="tw-text-grey-700 tw-text-sm tw-mb-1">No tasks yet</p>
          <p className="tw-text-grey-500 tw-text-sm">Use the quick-add bar above or create a task with full details.</p>
        </div>
      )}

      {/* Filtered empty state */}
      {tasks.length > 0 && filteredTasks.length === 0 && (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
          <p className="tw-text-grey-500 tw-text-sm">No tasks match the current filters.</p>
          <button
            onClick={() => { setFilterCategory(''); setFilterPriority(''); setFilterNature(''); setShowCompleted(false) }}
            className="tw-text-purps-500 hover:tw-text-purps-600 tw-text-sm tw-font-medium tw-mt-2 tw-transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Task list */}
      {filteredTasks.length > 0 && (
        <div className="tw-space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`tw-bg-white tw-border tw-border-grey-200 tw-rounded-xl tw-px-4 tw-py-3 tw-transition-all hover:tw-border-grey-300 hover:tw-shadow-md tw-group tw-border-l-[3px] ${getCategoryBorder(task.category)}`}
            >
              <div className="tw-flex tw-items-center tw-gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`tw-w-4 tw-h-4 tw-rounded tw-border tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-transition-colors ${
                    task.is_done
                      ? 'tw-bg-purps-500 tw-border-purps-500 tw-text-white'
                      : 'tw-border-grey-300 tw-bg-white hover:tw-border-purps-400'
                  }`}
                >
                  {task.is_done && (
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Priority indicator */}
                <PriorityIndicator priority={task.priority} />

                {/* Title */}
                <div
                  className="tw-flex-1 tw-min-w-0 tw-cursor-pointer"
                  onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                >
                  <span className={`tw-text-sm ${
                    task.is_done
                      ? 'tw-text-grey-400 tw-line-through'
                      : 'tw-text-grey-800'
                  }`}>
                    {task.title}
                  </span>
                </div>

                {/* Project name pill */}
                {task.project_id && task.projects?.name && (
                  <span className="tw-inline-flex tw-items-center tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-border tw-bg-purps-500/10 tw-text-purps-600 tw-border-purps-500/20 tw-flex-shrink-0">
                    {task.projects.name}
                  </span>
                )}

                {/* Category badge */}
                <div className="tw-flex-shrink-0">
                  <CategoryBadge category={task.category} />
                </div>

                {/* Due date */}
                {task.due_date && (
                  <span className={`tw-text-xs tw-flex-shrink-0 tw-whitespace-nowrap ${
                    task.is_done
                      ? 'tw-text-grey-400'
                      : isOverdue(task.due_date)
                      ? 'tw-text-warningred-500 tw-font-medium'
                      : 'tw-text-grey-400'
                  }`}>
                    {formatDueDate(task.due_date)}
                  </span>
                )}

                {/* Edit chevron */}
                <div
                  className="tw-flex-shrink-0 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity tw-cursor-pointer"
                  onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                >
                  <svg className="tw-w-4 tw-h-4 tw-text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task form slide-out */}
      {showTaskForm && (
        <TaskForm
          task={editingTask?.id ? editingTask : null}
          onSave={handleSaveTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null) }}
        />
      )}
    </div>
  )
}
