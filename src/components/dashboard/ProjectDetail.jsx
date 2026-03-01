import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from 'Lib/supabase'
import { STAGES, getNextStage, getStageIndex } from 'Lib/projectDefaults'

const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"
const btnCancel = "tw-text-grey-500 hover:tw-text-grey-700 tw-px-3 tw-py-2 tw-text-sm tw-transition-colors"
const btnDanger = "tw-bg-warningred-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-opacity-90 tw-transition-colors"

function IconX({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconChevron({ open }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`tw-transition-transform tw-duration-200 ${open ? 'tw-rotate-90' : 'tw-rotate-0'}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function IconList({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconNote({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconTodo({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export default function ProjectDetail({ project, onClose, onProjectUpdated }) {
  // === Local copies of project fields ===
  const [localName, setLocalName] = useState('')
  const [localDescription, setLocalDescription] = useState('')
  const [localPriority, setLocalPriority] = useState('normal')
  const [localTeamId, setLocalTeamId] = useState('')
  const [localStage, setLocalStage] = useState('planning')
  const [localPrimaryDev, setLocalPrimaryDev] = useState('')
  const [localSecondaryDev, setLocalSecondaryDev] = useState('')
  const [localStageNotes, setLocalStageNotes] = useState({})

  // === Checklist (fetched + locally modified) ===
  const [checklistItems, setChecklistItems] = useState([])
  const [localChecklistChanges, setLocalChecklistChanges] = useState({})
  const [newChecklistItems, setNewChecklistItems] = useState([])

  // === Stage TODOs (from tasks table) ===
  const [todos, setTodos] = useState([])
  const [localTodoChanges, setLocalTodoChanges] = useState({})
  const [newTodos, setNewTodos] = useState([])
  const [deletedTodoIds, setDeletedTodoIds] = useState([])

  // === Reference data ===
  const [teams, setTeams] = useState([])
  const [engineers, setEngineers] = useState([])

  // === UI state ===
  const [openStages, setOpenStages] = useState({})
  const [editingName, setEditingName] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [newChecklistInput, setNewChecklistInput] = useState({})
  const [newTodoInput, setNewTodoInput] = useState({})
  const [stageSection, setStageSection] = useState({}) // stageId -> 'checklist'|'notes'|'todos'

  const nameInputRef = useRef(null)
  const baselineRef = useRef(null)

  // === Initialization ===
  useEffect(() => {
    if (!project?.id) return
    setInitialLoading(true)

    setLocalName(project.name || '')
    setLocalDescription(project.description || '')
    setLocalPriority(project.priority || 'normal')
    setLocalTeamId(project.team_id || '')
    setLocalStage(project.stage || 'planning')
    setLocalPrimaryDev(project.primary_dev_id || '')
    setLocalSecondaryDev(project.secondary_dev_id || '')
    setLocalStageNotes(project.stage_notes || {})
    setOpenStages({ [project.stage]: true })
    setEditingName(false)
    setConfirmDelete(false)

    setLocalChecklistChanges({})
    setNewChecklistItems([])
    setLocalTodoChanges({})
    setNewTodos([])
    setDeletedTodoIds([])
    setNewChecklistInput({})
    setNewTodoInput({})
    setStageSection({})
    setSaveError(null)

    baselineRef.current = {
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'normal',
      team_id: project.team_id || '',
      stage: project.stage || 'planning',
      primary_dev_id: project.primary_dev_id || '',
      secondary_dev_id: project.secondary_dev_id || '',
      stage_notes: project.stage_notes || {},
    }

    Promise.all([
      supabase.from('project_checklist').select('*').eq('project_id', project.id).order('stage').order('sort_order'),
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('engineers').select('id, name, team_id, role').order('name'),
      supabase.from('tasks').select('*').eq('project_id', project.id).order('created_at'),
    ]).then(([checklistRes, teamsRes, engineersRes, todosRes]) => {
      setChecklistItems(checklistRes.data || [])
      setTeams(teamsRes.data || [])
      setEngineers(engineersRes.data || [])
      setTodos(todosRes.data || [])
      setInitialLoading(false)
    })
  }, [project?.id])

  // Focus name input when editing
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  // === Dirty tracking (compares against baseline, not stale prop) ===
  const isDirty = useMemo(() => {
    const b = baselineRef.current
    if (!b) return false
    if (localName !== b.name) return true
    if (localDescription !== b.description) return true
    if (localPriority !== b.priority) return true
    if (localTeamId !== b.team_id) return true
    if (localStage !== b.stage) return true
    if (localPrimaryDev !== b.primary_dev_id) return true
    if (localSecondaryDev !== b.secondary_dev_id) return true
    if (JSON.stringify(localStageNotes) !== JSON.stringify(b.stage_notes)) return true
    if (Object.keys(localChecklistChanges).length > 0) return true
    if (newChecklistItems.length > 0) return true
    if (Object.keys(localTodoChanges).length > 0) return true
    if (newTodos.length > 0) return true
    if (deletedTodoIds.length > 0) return true
    return false
  }, [localName, localDescription, localPriority, localTeamId, localStage, localPrimaryDev, localSecondaryDev, localStageNotes, localChecklistChanges, newChecklistItems, localTodoChanges, newTodos, deletedTodoIds])

  // === Save handler ===
  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const { error: projectError } = await supabase.from('projects').update({
        name: localName.trim(),
        description: localDescription || null,
        priority: localPriority,
        team_id: localTeamId || null,
        stage: localStage,
        primary_dev_id: localPrimaryDev || null,
        secondary_dev_id: localSecondaryDev || null,
        stage_notes: localStageNotes,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id)

      if (projectError) throw projectError

      const checklistUpdates = Object.entries(localChecklistChanges)
      for (const [itemId, isChecked] of checklistUpdates) {
        const { error } = await supabase.from('project_checklist').update({ is_checked: isChecked }).eq('id', itemId)
        if (error) throw error
      }

      if (newChecklistItems.length > 0) {
        const { error } = await supabase.from('project_checklist').insert(
          newChecklistItems.map((item, idx) => ({
            project_id: project.id,
            stage: item.stage,
            item: item.item,
            is_checked: item.is_checked,
            sort_order: 100 + idx,
          }))
        )
        if (error) throw error
      }

      const todoUpdates = Object.entries(localTodoChanges)
      for (const [todoId, isDone] of todoUpdates) {
        const { error } = await supabase.from('tasks').update({ is_done: isDone }).eq('id', todoId)
        if (error) throw error
      }

      if (newTodos.length > 0) {
        const { error } = await supabase.from('tasks').insert(
          newTodos.map((todo) => ({
            title: todo.title,
            category: 'project_req',
            project_id: project.id,
            stage: todo.stage,
            is_done: todo.is_done,
          }))
        )
        if (error) throw error
      }

      if (deletedTodoIds.length > 0) {
        const { error } = await supabase.from('tasks').delete().in('id', deletedTodoIds)
        if (error) throw error
      }

      // Update baseline so isDirty resets
      baselineRef.current = {
        name: localName.trim(),
        description: localDescription || '',
        priority: localPriority,
        team_id: localTeamId,
        stage: localStage,
        primary_dev_id: localPrimaryDev,
        secondary_dev_id: localSecondaryDev,
        stage_notes: localStageNotes,
      }

      // Re-fetch checklist & todos (new items now have real IDs)
      const [checklistRes, todosRes] = await Promise.all([
        supabase.from('project_checklist').select('*').eq('project_id', project.id).order('stage').order('sort_order'),
        supabase.from('tasks').select('*').eq('project_id', project.id).order('created_at'),
      ])
      setChecklistItems(checklistRes.data || [])
      setTodos(todosRes.data || [])

      // Reset change tracking
      setLocalChecklistChanges({})
      setNewChecklistItems([])
      setLocalTodoChanges({})
      setNewTodos([])
      setDeletedTodoIds([])
      setNewChecklistInput({})
      setNewTodoInput({})

      setSaving(false)
      onProjectUpdated()
    } catch (err) {
      const msg = err.message || 'Failed to save'
      // Hint if it looks like missing columns from migration 002
      if (msg.includes('stage_notes') || msg.includes('primary_dev_id') || msg.includes('secondary_dev_id')) {
        setSaveError('Missing DB columns — run supabase/002-stage-notes.sql in the SQL editor first.')
      } else {
        setSaveError(msg)
      }
      setSaving(false)
    }
  }

  // === Delete handler ===
  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setSaving(true)
    await supabase.from('tasks').delete().eq('project_id', project.id)
    await supabase.from('project_checklist').delete().eq('project_id', project.id)
    await supabase.from('projects').delete().eq('id', project.id)
    setSaving(false)
    onClose()
    onProjectUpdated()
  }

  // === Interaction handlers (all local, no DB calls) ===

  function toggleChecklistItem(itemId) {
    const item = checklistItems.find(i => i.id === itemId)
    if (!item) return
    const currentState = localChecklistChanges[itemId] !== undefined ? localChecklistChanges[itemId] : item.is_checked
    setLocalChecklistChanges(prev => ({ ...prev, [itemId]: !currentState }))
  }

  function toggleNewChecklistItem(tempId) {
    setNewChecklistItems(prev => prev.map(i => i.tempId === tempId ? { ...i, is_checked: !i.is_checked } : i))
  }

  function addChecklistItem(stageId) {
    const text = (newChecklistInput[stageId] || '').trim()
    if (!text) return
    setNewChecklistItems(prev => [...prev, { tempId: Date.now() + '_' + Math.random(), stage: stageId, item: text, is_checked: false }])
    setNewChecklistInput(prev => ({ ...prev, [stageId]: '' }))
  }

  function removeNewChecklistItem(tempId) {
    setNewChecklistItems(prev => prev.filter(i => i.tempId !== tempId))
  }

  function toggleTodo(todoId) {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return
    const currentState = localTodoChanges[todoId] !== undefined ? localTodoChanges[todoId] : todo.is_done
    setLocalTodoChanges(prev => ({ ...prev, [todoId]: !currentState }))
  }

  function toggleNewTodo(tempId) {
    setNewTodos(prev => prev.map(t => t.tempId === tempId ? { ...t, is_done: !t.is_done } : t))
  }

  function addTodo(stageId) {
    const text = (newTodoInput[stageId] || '').trim()
    if (!text) return
    setNewTodos(prev => [...prev, { tempId: Date.now() + '_' + Math.random(), stage: stageId, title: text, is_done: false }])
    setNewTodoInput(prev => ({ ...prev, [stageId]: '' }))
  }

  function deleteTodo(todoId) {
    setDeletedTodoIds(prev => [...prev, todoId])
  }

  function removeNewTodo(tempId) {
    setNewTodos(prev => prev.filter(t => t.tempId !== tempId))
  }

  function setStage(stageId) {
    setLocalStage(stageId)
    setOpenStages(prev => ({ ...prev, [stageId]: true }))
  }

  function toggleStage(stageId) {
    setOpenStages(prev => ({ ...prev, [stageId]: !prev[stageId] }))
  }

  // === Overlay close / discard ===

  function handleOverlayClose() {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  function discardChanges() {
    setSaveError(null)
    setLocalName(project.name || '')
    setLocalDescription(project.description || '')
    setLocalPriority(project.priority || 'normal')
    setLocalTeamId(project.team_id || '')
    setLocalStage(project.stage || 'planning')
    setLocalPrimaryDev(project.primary_dev_id || '')
    setLocalSecondaryDev(project.secondary_dev_id || '')
    setLocalStageNotes(project.stage_notes || {})
    setLocalChecklistChanges({})
    setNewChecklistItems([])
    setLocalTodoChanges({})
    setNewTodos([])
    setDeletedTodoIds([])
    setNewChecklistInput({})
    setNewTodoInput({})
  }

  // === Derived data ===

  const currentStageIndex = getStageIndex(localStage)

  function getEffectiveChecklist(stageId) {
    const dbItems = checklistItems.filter(i => i.stage === stageId).map(item => ({
      ...item,
      is_checked: localChecklistChanges[item.id] !== undefined ? localChecklistChanges[item.id] : item.is_checked,
      isFromDb: true,
    }))
    const newItems = newChecklistItems.filter(i => i.stage === stageId).map(item => ({
      ...item,
      id: item.tempId,
      isFromDb: false,
    }))
    return [...dbItems, ...newItems]
  }

  function getEffectiveTodos(stageId) {
    const dbTodos = todos
      .filter(t => t.stage === stageId && !deletedTodoIds.includes(t.id))
      .map(todo => ({
        ...todo,
        is_done: localTodoChanges[todo.id] !== undefined ? localTodoChanges[todo.id] : todo.is_done,
        isFromDb: true,
      }))
    const newItems = newTodos.filter(t => t.stage === stageId).map(t => ({
      ...t,
      id: t.tempId,
      isFromDb: false,
    }))
    return [...dbTodos, ...newItems]
  }

  function stageProgress(stageId) {
    const items = getEffectiveChecklist(stageId)
    if (items.length === 0) return { checked: 0, total: 0 }
    const checked = items.filter(i => i.is_checked).length
    return { checked, total: items.length }
  }

  // === Helpers ===

  function priorityBadgeClasses(priority) {
    switch (priority) {
      case 'high': return 'tw-bg-warningred-100 tw-text-warningred-700'
      case 'low': return 'tw-bg-grey-100 tw-text-grey-500'
      default: return 'tw-bg-candy-100 tw-text-candy-700'
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function engineerLabel(eng) {
    if (eng.role) return `${eng.name} (${eng.role})`
    return eng.name
  }

  function teamName(teamId) {
    const t = teams.find(tm => tm.id === teamId)
    return t ? t.name : ''
  }

  function stageLabel(stageId) {
    const s = STAGES.find(st => st.id === stageId)
    return s ? s.label : stageId
  }

  if (!project) return null

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-justify-end">
      {/* Overlay */}
      <div
        className="tw-absolute tw-inset-0 tw-bg-black tw-bg-opacity-30"
        onClick={handleOverlayClose}
      />

      {/* Panel */}
      <div className="tw-relative tw-w-[520px] tw-max-w-full tw-h-full tw-bg-white tw-shadow-2xl tw-flex tw-flex-col tw-overflow-hidden tw-animate-slide-in-right">

        {/* HEADER */}
        <div className="tw-px-6 tw-pt-5 tw-pb-4 tw-border-b tw-border-grey-200">
          {/* Top row: name + close */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
            <div className="tw-flex-1 tw-min-w-0">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingName(false)
                    if (e.key === 'Escape') { setLocalName(project.name || ''); setEditingName(false) }
                  }}
                  className={`${inputClass} tw-w-full tw-text-lg tw-font-semibold`}
                />
              ) : (
                <h2
                  className="tw-text-lg tw-font-semibold tw-text-grey-900 tw-cursor-pointer hover:tw-text-purps-600 tw-truncate tw-transition-colors"
                  onClick={() => setEditingName(true)}
                  title="Click to edit name"
                >
                  {localName || 'Untitled Project'}
                </h2>
              )}
            </div>
            <button
              onClick={handleOverlayClose}
              className="tw-text-grey-400 hover:tw-text-grey-600 tw-transition-colors tw-flex-shrink-0 tw-mt-0.5"
            >
              <IconX size={20} />
            </button>
          </div>

          {/* Second row: badges */}
          <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2 tw-flex-wrap">
            <span className={`tw-text-xs tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full ${priorityBadgeClasses(localPriority)}`}>
              {localPriority.charAt(0).toUpperCase() + localPriority.slice(1)}
            </span>
            {localTeamId && (
              <span className="tw-text-xs tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-purps-50 tw-text-purps-600">
                {teamName(localTeamId)}
              </span>
            )}
            <span className="tw-text-xs tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-purps-100 tw-text-purps-700">
              {stageLabel(localStage)}
            </span>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="tw-flex-1 tw-overflow-y-auto tw-px-6 tw-py-5">
          {initialLoading ? (
            <div className="tw-text-sm tw-text-grey-400 tw-py-8 tw-text-center">Loading...</div>
          ) : (
            <>
              {/* STAGE PROGRESS */}
              <div className="tw-mb-6">
                <div className="tw-flex tw-items-center tw-gap-0.5">
                  {STAGES.map((stage, idx) => {
                    const isCompleted = idx < currentStageIndex
                    const isCurrent = stage.id === localStage
                    const displayLabel = stage.id === 'implementation' ? 'Impl' : stage.label

                    return (
                      <button
                        key={stage.id}
                        onClick={() => setStage(stage.id)}
                        title={stage.label}
                        className={`tw-flex-1 tw-py-2 tw-text-center tw-text-[11px] tw-font-medium tw-transition-all tw-cursor-pointer tw-border ${
                          idx === 0 ? 'tw-rounded-l-lg' : ''
                        } ${idx === STAGES.length - 1 ? 'tw-rounded-r-lg' : ''} ${
                          isCompleted
                            ? 'tw-bg-purps-500 tw-text-white tw-border-purps-500 hover:tw-bg-purps-600'
                            : isCurrent
                            ? 'tw-bg-purps-50 tw-text-purps-700 tw-font-semibold tw-border-purps-300'
                            : 'tw-bg-grey-100 tw-text-grey-400 tw-border-grey-100 hover:tw-bg-grey-200 hover:tw-text-grey-500'
                        }`}
                      >
                        {isCompleted ? <IconCheck size={12} /> : displayLabel}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* DEV ASSIGNMENT */}
              <div className="tw-mb-5">
                <h3 className="tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider tw-mb-2">Assigned Devs</h3>
                <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                  <div>
                    <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Frontend Dev</label>
                    <select
                      value={localPrimaryDev}
                      onChange={(e) => setLocalPrimaryDev(e.target.value)}
                      className={`${inputClass} tw-w-full`}
                    >
                      <option value="">Unassigned</option>
                      {engineers.map(eng => (
                        <option key={eng.id} value={eng.id}>{engineerLabel(eng)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Backend Dev</label>
                    <select
                      value={localSecondaryDev}
                      onChange={(e) => setLocalSecondaryDev(e.target.value)}
                      className={`${inputClass} tw-w-full`}
                    >
                      <option value="">Unassigned</option>
                      {engineers.map(eng => (
                        <option key={eng.id} value={eng.id}>{engineerLabel(eng)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* DETAILS */}
              <div className="tw-mb-5">
                <h3 className="tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider tw-mb-2">Details</h3>
                <div className="tw-space-y-3">
                  <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                    <div>
                      <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Priority</label>
                      <select
                        value={localPriority}
                        onChange={(e) => setLocalPriority(e.target.value)}
                        className={`${inputClass} tw-w-full`}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Team</label>
                      <select
                        value={localTeamId}
                        onChange={(e) => setLocalTeamId(e.target.value)}
                        className={`${inputClass} tw-w-full`}
                      >
                        <option value="">No team</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="tw-text-xs tw-text-grey-400 tw-mb-1 tw-block">Description</label>
                    <textarea
                      value={localDescription}
                      onChange={(e) => setLocalDescription(e.target.value)}
                      rows={3}
                      placeholder="Add a description..."
                      className={`${inputClass} tw-w-full tw-resize-none`}
                    />
                  </div>
                </div>
              </div>

              {/* STAGES ACCORDION */}
              <div className="tw-mb-5">
                <h3 className="tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider tw-mb-2">Stages</h3>
                <div className="tw-border tw-border-grey-200 tw-rounded-lg tw-overflow-hidden tw-divide-y tw-divide-grey-200">
                  {STAGES.map(stage => {
                    const isOpen = openStages[stage.id]
                    const isCurrent = stage.id === localStage
                    const stageIdx = getStageIndex(stage.id)
                    const isBeforeCurrent = stageIdx < currentStageIndex
                    const { checked, total } = stageProgress(stage.id)
                    const effectiveChecklist = getEffectiveChecklist(stage.id)
                    const effectiveTodos = getEffectiveTodos(stage.id)

                    return (
                      <div key={stage.id}>
                        {/* Stage header */}
                        <button
                          onClick={() => toggleStage(stage.id)}
                          className={`tw-w-full tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-3 tw-text-left tw-transition-colors ${
                            isCurrent ? 'tw-bg-purps-50' : 'tw-bg-white hover:tw-bg-grey-50'
                          }`}
                        >
                          <IconChevron open={isOpen} />
                          <span className={`tw-text-sm tw-flex-1 ${
                            isCurrent ? 'tw-text-purps-700 tw-font-medium' : 'tw-text-grey-800 tw-font-medium'
                          }`}>
                            {stage.label}
                          </span>
                          {!isCurrent && (
                            <span
                              onClick={(e) => { e.stopPropagation(); setStage(stage.id) }}
                              className="tw-text-xs tw-text-purps-500 hover:tw-text-purps-600 tw-font-medium tw-px-2 tw-py-0.5 tw-rounded hover:tw-bg-purps-50 tw-cursor-pointer tw-transition-colors"
                            >
                              Set as current
                            </span>
                          )}
                          {isCurrent && (
                            <span className="tw-text-xs tw-bg-purps-100 tw-text-purps-600 tw-px-2 tw-py-0.5 tw-rounded-full tw-font-medium">
                              Current
                            </span>
                          )}
                          {total > 0 && (
                            <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-grey-100 tw-text-grey-500">
                              {checked}/{total}
                            </span>
                          )}
                        </button>

                        {/* Expanded content with icon tabs */}
                        {isOpen && (() => {
                          const activeSection = stageSection[stage.id] || 'checklist'
                          const hasNotes = !!(localStageNotes[stage.id] || '').trim()
                          const todoCount = effectiveTodos.length
                          const tabs = [
                            { id: 'checklist', icon: <IconList />, label: 'Checklist', badge: total > 0 ? `${checked}/${total}` : null },
                            { id: 'notes', icon: <IconNote />, label: 'Notes', badge: hasNotes ? '\u2022' : null },
                            { id: 'todos', icon: <IconTodo />, label: 'TODOs', badge: todoCount > 0 ? String(todoCount) : null },
                          ]
                          return (
                            <div className="tw-px-4 tw-pb-3 tw-pt-1 tw-bg-white">
                              {/* Icon tab bar */}
                              <div className="tw-flex tw-items-center tw-gap-1 tw-mb-2 tw-border-b tw-border-grey-100 tw-pb-2">
                                {tabs.map(tab => (
                                  <button
                                    key={tab.id}
                                    onClick={() => setStageSection(prev => ({ ...prev, [stage.id]: tab.id }))}
                                    className={`tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded tw-text-xs tw-font-medium tw-transition-colors ${
                                      activeSection === tab.id
                                        ? 'tw-bg-purps-50 tw-text-purps-600'
                                        : 'tw-text-grey-400 hover:tw-text-grey-600 hover:tw-bg-grey-50'
                                    }`}
                                  >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.badge && (
                                      <span className={`tw-text-[10px] tw-ml-0.5 ${activeSection === tab.id ? 'tw-text-purps-400' : 'tw-text-grey-300'}`}>
                                        {tab.badge}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>

                              {/* CHECKLIST section */}
                              {activeSection === 'checklist' && (
                                <div>
                                  {effectiveChecklist.length === 0 && (
                                    <p className="tw-text-xs tw-text-grey-300 tw-italic tw-mb-1">No checklist items</p>
                                  )}
                                  {effectiveChecklist.map(item => (
                                    <div key={item.id} className="tw-flex tw-items-center tw-gap-2.5 tw-py-1">
                                      <button
                                        onClick={() => item.isFromDb ? toggleChecklistItem(item.id) : toggleNewChecklistItem(item.tempId)}
                                        className={`tw-w-4 tw-h-4 tw-rounded tw-border tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-transition-colors ${
                                          item.is_checked ? 'tw-bg-purps-500 tw-border-purps-500 tw-text-white' : 'tw-border-grey-300 tw-bg-white hover:tw-border-purps-400'
                                        }`}
                                      >
                                        {item.is_checked && <IconCheck size={10} />}
                                      </button>
                                      <span className={`tw-text-xs tw-flex-1 ${item.is_checked ? 'tw-text-grey-400 tw-line-through' : 'tw-text-grey-700'}`}>
                                        {item.item}
                                      </span>
                                      {!item.isFromDb && (
                                        <button onClick={() => removeNewChecklistItem(item.tempId)} className="tw-text-grey-300 hover:tw-text-warningred-500 tw-transition-colors">
                                          <IconX size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2">
                                    <input
                                      value={newChecklistInput[stage.id] || ''}
                                      onChange={(e) => setNewChecklistInput(prev => ({ ...prev, [stage.id]: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(stage.id) }}
                                      placeholder="Add item..."
                                      className={`${inputClass} tw-flex-1 tw-py-1 tw-text-xs`}
                                    />
                                    <button onClick={() => addChecklistItem(stage.id)} className="tw-text-purps-500 tw-text-xs tw-font-medium hover:tw-text-purps-600">Add</button>
                                  </div>
                                </div>
                              )}

                              {/* NOTES section */}
                              {activeSection === 'notes' && (
                                <textarea
                                  value={localStageNotes[stage.id] || ''}
                                  onChange={(e) => setLocalStageNotes(prev => ({ ...prev, [stage.id]: e.target.value }))}
                                  rows={3}
                                  placeholder="Add notes for this stage..."
                                  className={`${inputClass} tw-w-full tw-resize-none tw-text-xs`}
                                />
                              )}

                              {/* TODOS section */}
                              {activeSection === 'todos' && (
                                <div>
                                  {effectiveTodos.length === 0 && (
                                    <p className="tw-text-xs tw-text-grey-300 tw-italic tw-mb-1">No TODOs yet</p>
                                  )}
                                  {effectiveTodos.map(todo => (
                                    <div key={todo.id} className="tw-flex tw-items-center tw-gap-2.5 tw-py-1">
                                      <button
                                        onClick={() => todo.isFromDb ? toggleTodo(todo.id) : toggleNewTodo(todo.tempId)}
                                        className={`tw-w-4 tw-h-4 tw-rounded tw-border tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-transition-colors ${
                                          todo.is_done ? 'tw-bg-purps-500 tw-border-purps-500 tw-text-white' : 'tw-border-grey-300 tw-bg-white hover:tw-border-purps-400'
                                        }`}
                                      >
                                        {todo.is_done && <IconCheck size={10} />}
                                      </button>
                                      <span className={`tw-text-xs tw-flex-1 ${todo.is_done ? 'tw-text-grey-400 tw-line-through' : 'tw-text-grey-700'}`}>
                                        {todo.title}
                                      </span>
                                      <button
                                        onClick={() => todo.isFromDb ? deleteTodo(todo.id) : removeNewTodo(todo.tempId)}
                                        className="tw-text-grey-300 hover:tw-text-warningred-500 tw-transition-colors"
                                      >
                                        <IconX size={12} />
                                      </button>
                                    </div>
                                  ))}
                                  <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2">
                                    <input
                                      value={newTodoInput[stage.id] || ''}
                                      onChange={(e) => setNewTodoInput(prev => ({ ...prev, [stage.id]: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') addTodo(stage.id) }}
                                      placeholder="Add TODO..."
                                      className={`${inputClass} tw-flex-1 tw-py-1 tw-text-xs`}
                                    />
                                    <button onClick={() => addTodo(stage.id)} className="tw-text-purps-500 tw-text-xs tw-font-medium hover:tw-text-purps-600">Add</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* METADATA */}
              <div className="tw-text-xs tw-text-grey-400 tw-space-y-1 tw-mb-5">
                <div>Created: {formatDate(project.created_at)}</div>
                <div>Updated: {formatDate(project.updated_at)}</div>
              </div>

              {/* DELETE */}
              <div className="tw-border-t tw-border-grey-200 tw-pt-4">
                {confirmDelete ? (
                  <div className="tw-flex tw-items-center tw-gap-3">
                    <span className="tw-text-sm tw-text-warningred-500">Delete this project?</span>
                    <button
                      onClick={handleDelete}
                      className={`${btnDanger} tw-text-xs tw-px-3 tw-py-1.5`}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className={`${btnCancel} tw-text-xs`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-grey-400 hover:tw-text-warningred-500 tw-transition-colors"
                  >
                    <IconTrash /> Delete project
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* STICKY SAVE BAR */}
        {(isDirty || saveError) && (
          <div className="tw-px-6 tw-py-3 tw-border-t tw-border-grey-200 tw-bg-white">
            {saveError && (
              <div className="tw-mb-2 tw-text-xs tw-text-warningred-500 tw-bg-warningred-100 tw-px-3 tw-py-1.5 tw-rounded-lg">
                {saveError}
              </div>
            )}
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-text-xs tw-text-grey-500">
                {saveError ? 'Save failed — retry or discard' : 'Unsaved changes'}
              </span>
              <div className="tw-flex tw-items-center tw-gap-2">
                <button onClick={discardChanges} className={`${btnCancel} tw-text-xs`}>
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`${btnPrimary} disabled:tw-opacity-50`}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
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
