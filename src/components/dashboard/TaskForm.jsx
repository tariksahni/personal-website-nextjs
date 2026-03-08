import { useState, useEffect } from 'react'

const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"
const btnCancel = "tw-text-grey-500 hover:tw-text-grey-700 tw-px-3 tw-py-2 tw-text-sm tw-transition-colors"

const CATEGORIES = [
  { value: 'reply', label: 'Reply' },
  { value: 'review', label: 'Review' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'decision', label: 'Decision' },
  { value: 'misc', label: 'Misc' },
]

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

export default function TaskForm({ task, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('misc')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setCategory(task.category || 'misc')
      setPriority(task.priority || 'normal')
      setDueDate(task.due_date || '')
      setNotes(task.notes || '')
    } else {
      setTitle('')
      setCategory('misc')
      setPriority('normal')
      setDueDate('')
      setNotes('')
    }
  }, [task])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      category,
      priority,
      due_date: dueDate || null,
      notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-justify-end">
      {/* Overlay */}
      <div
        className="tw-absolute tw-inset-0 tw-bg-black tw-bg-opacity-30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="tw-relative tw-w-[480px] tw-max-w-full tw-h-full tw-bg-white tw-shadow-2xl tw-flex tw-flex-col tw-overflow-hidden tw-animate-slide-in-right">

        {/* Header */}
        <div className="tw-px-6 tw-pt-5 tw-pb-4 tw-border-b tw-border-grey-200">
          <div className="tw-flex tw-items-center tw-justify-between">
            <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900">
              {task ? 'Edit Task' : 'New Task'}
            </h2>
            <button
              onClick={onClose}
              className="tw-text-grey-400 hover:tw-text-grey-600 tw-transition-colors"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="tw-flex-1 tw-overflow-y-auto tw-px-6 tw-py-5">
          <div className="tw-space-y-4">
            {/* Title */}
            <div>
              <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                className={`${inputClass} tw-w-full`}
                autoFocus
                required
              />
            </div>

            {/* Category + Priority */}
            <div className="tw-grid tw-grid-cols-2 tw-gap-3">
              <div>
                <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`${inputClass} tw-w-full`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`${inputClass} tw-w-full`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} tw-w-full`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes..."
                className={`${inputClass} tw-w-full tw-resize-none`}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="tw-px-6 tw-py-3 tw-border-t tw-border-grey-200 tw-bg-white">
          <div className="tw-flex tw-items-center tw-justify-end tw-gap-2">
            <button type="button" onClick={onClose} className={btnCancel}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className={`${btnPrimary} disabled:tw-opacity-50`}
            >
              {saving ? 'Saving...' : task ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .tw-animate-slide-in-right {
          animation: slide-in-right 200ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
