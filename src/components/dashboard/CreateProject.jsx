import { useState, useEffect, useCallback } from 'react'
import { supabase } from 'Lib/supabase'
import { STAGES } from 'Lib/projectDefaults'

const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"
const btnCancel = "tw-text-grey-500 hover:tw-text-grey-700 tw-px-3 tw-py-2 tw-text-sm tw-transition-colors"
const labelClass = "tw-block tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider tw-mb-1.5"

export default function CreateProject({ isOpen, onClose, onCreated }) {
  const [teams, setTeams] = useState([])
  const [engineers, setEngineers] = useState([])
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [description, setDescription] = useState('')
  const [frontendDev, setFrontendDev] = useState('')
  const [backendDev, setBackendDev] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchTeams()
      fetchEngineers()
      setName('')
      setTeamId('')
      setPriority('normal')
      setDescription('')
      setFrontendDev('')
      setBackendDev('')
      setError(null)
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  async function fetchTeams() {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    setTeams(data || [])
  }

  async function fetchEngineers() {
    const { data } = await supabase.from('engineers').select('id, name, role').order('name')
    setEngineers(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    setSaving(true)
    setError(null)

    try {
      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: trimmedName,
          team_id: teamId || null,
          priority,
          description: description.trim() || null,
          primary_dev_id: frontendDev || null,
          secondary_dev_id: backendDev || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      onCreated()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-p-4"
      onClick={onClose}
    >
      <div className="tw-absolute tw-inset-0 tw-bg-grey-900/40 tw-backdrop-blur-sm" />

      <div
        className="tw-relative tw-bg-white tw-rounded-xl tw-shadow-xl tw-border tw-border-grey-200 tw-w-full tw-max-w-lg tw-max-h-[90vh] tw-overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-flex tw-items-center tw-justify-between tw-px-6 tw-pt-6 tw-pb-4 tw-border-b tw-border-grey-100">
          <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900">New Project</h2>
          <button
            onClick={onClose}
            className="tw-text-grey-400 hover:tw-text-grey-600 tw-transition-colors tw-p-1 tw-rounded-md hover:tw-bg-grey-100"
          >
            <svg className="tw-w-5 tw-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tw-px-6 tw-py-5 tw-space-y-5">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
              required
              className={inputClass + " tw-w-full"}
            />
          </div>

          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            <div>
              <label className={labelClass}>Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={inputClass + " tw-w-full tw-appearance-none tw-cursor-pointer"}
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass + " tw-w-full tw-appearance-none tw-cursor-pointer"}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description (optional)"
              rows={3}
              className={inputClass + " tw-w-full tw-resize-none"}
            />
          </div>

          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            <div>
              <label className={labelClass}>Frontend Dev</label>
              <select
                value={frontendDev}
                onChange={(e) => setFrontendDev(e.target.value)}
                className={inputClass + " tw-w-full tw-appearance-none tw-cursor-pointer"}
              >
                <option value="">Unassigned</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>{eng.name}{eng.role ? ` (${eng.role})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Backend Dev</label>
              <select
                value={backendDev}
                onChange={(e) => setBackendDev(e.target.value)}
                className={inputClass + " tw-w-full tw-appearance-none tw-cursor-pointer"}
              >
                <option value="">Unassigned</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>{eng.name}{eng.role ? ` (${eng.role})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="tw-bg-warningred-500/5 tw-border tw-border-warningred-500/20 tw-rounded-lg tw-px-3 tw-py-2">
              <p className="tw-text-warningred-500 tw-text-sm">{error}</p>
            </div>
          )}

          <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-pt-2">
            <button type="button" onClick={onClose} className={btnCancel}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={btnPrimary + " tw-flex tw-items-center tw-gap-2 tw-shadow-sm disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"}
            >
              {saving && (
                <div className="tw-w-3.5 tw-h-3.5 tw-border-2 tw-border-white/30 tw-border-t-white tw-rounded-full tw-animate-spin" />
              )}
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
