import { useState, useEffect } from 'react'
import { supabase } from 'Lib/supabase'

export default function TeamsTab() {
  const [teams, setTeams] = useState([])
  const [engineersByTeam, setEngineersByTeam] = useState({})
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEngineers, setLoadingEngineers] = useState({})

  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [teamNameInput, setTeamNameInput] = useState('')

  const [addingEngineerTeamId, setAddingEngineerTeamId] = useState(null)
  const [editingEngineerId, setEditingEngineerId] = useState(null)
  const [engineerNameInput, setEngineerNameInput] = useState('')
  const [engineerRoleInput, setEngineerRoleInput] = useState('')
  const [engineerNotes, setEngineerNotes] = useState({})
  const [editingNoteEngId, setEditingNoteEngId] = useState(null)
  const [noteSaving, setNoteSaving] = useState({})

  useEffect(() => { fetchTeams() }, [])

  async function fetchTeams() {
    setLoadingTeams(true)
    const { data, error } = await supabase.from('teams').select('*').order('created_at')
    if (error) { setTeams([]); setLoadingTeams(false); return }
    const teamList = data || []
    setTeams(teamList)
    setLoadingTeams(false)
    // Auto-fetch engineers for all teams
    for (const team of teamList) {
      fetchEngineers(team.id)
    }
  }

  async function fetchEngineers(teamId) {
    setLoadingEngineers((prev) => ({ ...prev, [teamId]: true }))
    const { data } = await supabase.from('engineers').select('*').eq('team_id', teamId).order('name')
    setEngineersByTeam((prev) => ({ ...prev, [teamId]: data || [] }))
    // Load notes into local state
    for (const eng of data || []) {
      if (eng.notes) setEngineerNotes((prev) => ({ ...prev, [eng.id]: eng.notes }))
    }
    setLoadingEngineers((prev) => ({ ...prev, [teamId]: false }))
  }

  async function saveEngineerNotes(engId, teamId) {
    const notes = engineerNotes[engId] || ''
    setNoteSaving((prev) => ({ ...prev, [engId]: true }))
    await supabase.from('engineers').update({ notes }).eq('id', engId)
    setEngineersByTeam((prev) => {
      const engineers = prev[teamId]
      if (!engineers) return prev
      return {
        ...prev,
        [teamId]: engineers.map((e) => e.id === engId ? { ...e, notes } : e),
      }
    })
    setNoteSaving((prev) => ({ ...prev, [engId]: false }))
    setEditingNoteEngId(null)
  }

  function startAddTeam() { setIsAddingTeam(true); setEditingTeamId(null); setTeamNameInput('') }
  function startEditTeam(team) { setEditingTeamId(team.id); setIsAddingTeam(false); setTeamNameInput(team.name) }
  function cancelTeamForm() { setIsAddingTeam(false); setEditingTeamId(null); setTeamNameInput('') }

  async function saveTeam() {
    const name = teamNameInput.trim()
    if (!name) return
    if (editingTeamId) { await supabase.from('teams').update({ name }).eq('id', editingTeamId) }
    else { await supabase.from('teams').insert({ name }) }
    cancelTeamForm(); await fetchTeams()
  }

  async function deleteTeam(teamId) {
    if (!window.confirm('Delete this team? Engineers will be unassigned.')) return
    await supabase.from('teams').delete().eq('id', teamId)
    await fetchTeams()
  }

  function startAddEngineer(teamId) { setAddingEngineerTeamId(teamId); setEditingEngineerId(null); setEngineerNameInput(''); setEngineerRoleInput('') }
  function startEditEngineer(eng) { setEditingEngineerId(eng.id); setAddingEngineerTeamId(null); setEngineerNameInput(eng.name); setEngineerRoleInput(eng.role || '') }
  function cancelEngineerForm() { setAddingEngineerTeamId(null); setEditingEngineerId(null); setEngineerNameInput(''); setEngineerRoleInput('') }

  async function saveEngineer(teamId) {
    const name = engineerNameInput.trim()
    const role = engineerRoleInput.trim()
    if (!name) return
    if (editingEngineerId) { await supabase.from('engineers').update({ name, role }).eq('id', editingEngineerId) }
    else { await supabase.from('engineers').insert({ name, role, team_id: teamId }) }
    cancelEngineerForm(); await fetchEngineers(teamId)
  }

  async function deleteEngineer(engineerId, teamId) {
    if (!window.confirm('Remove this engineer?')) return
    await supabase.from('engineers').delete().eq('id', engineerId)
    await fetchEngineers(teamId)
  }

  function handleTeamKeyDown(e) { if (e.key === 'Enter') saveTeam(); if (e.key === 'Escape') cancelTeamForm() }
  function handleEngineerKeyDown(e, teamId) { if (e.key === 'Enter') saveEngineer(teamId); if (e.key === 'Escape') cancelEngineerForm() }

  const TEAM_COLORS = [
    { bg: 'tw-bg-purps-500/10', border: 'tw-border-purps-500/20', text: 'tw-text-purps-600', topBorder: 'tw-border-t-purps-500', roleBg: 'tw-bg-purps-500/10', roleText: 'tw-text-purps-600' },
    { bg: 'tw-bg-sky-500/10', border: 'tw-border-sky-500/20', text: 'tw-text-sky-600', topBorder: 'tw-border-t-sky-500', roleBg: 'tw-bg-sky-500/10', roleText: 'tw-text-sky-600' },
    { bg: 'tw-bg-candy-500/10', border: 'tw-border-candy-500/20', text: 'tw-text-candy-600', topBorder: 'tw-border-t-candy-500', roleBg: 'tw-bg-candy-500/10', roleText: 'tw-text-candy-600' },
    { bg: 'tw-bg-okaygreen-500/10', border: 'tw-border-okaygreen-500/20', text: 'tw-text-okaygreen-600', topBorder: 'tw-border-t-okaygreen-500', roleBg: 'tw-bg-okaygreen-500/10', roleText: 'tw-text-okaygreen-600' },
  ]

  const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-500 focus:tw-ring-1 focus:tw-ring-purps-500/20 tw-transition-all"
  const btnPrimary = "tw-bg-purps-500 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-purps-600 tw-transition-colors"
  const btnCancel = "tw-text-grey-500 hover:tw-text-grey-700 tw-px-3 tw-py-2 tw-text-sm tw-transition-colors"

  if (loadingTeams) {
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-py-24">
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-3">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
          <p className="tw-text-grey-500 tw-text-sm">Loading teams...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <div>
          <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900 tw-flex tw-items-center tw-gap-2">
            <svg className="tw-w-5 tw-h-5 tw-text-purps-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            Teams
          </h2>
          <p className="tw-text-sm tw-text-grey-500 tw-mt-0.5">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={startAddTeam} className={btnPrimary + " tw-flex tw-items-center tw-gap-1.5 tw-shadow-sm"}>
          <svg className="tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Team
        </button>
      </div>

      {isAddingTeam && (
        <div className="tw-mb-5 tw-bg-white tw-border tw-border-grey-200 tw-rounded-xl tw-p-4 tw-shadow-sm">
          <p className="tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider tw-mb-2.5">New Team</p>
          <div className="tw-flex tw-items-center tw-gap-3">
            <input type="text" value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} onKeyDown={handleTeamKeyDown} placeholder="Team name" autoFocus className={inputClass + " tw-flex-1"} />
            <button onClick={saveTeam} className={btnPrimary}>Save</button>
            <button onClick={cancelTeamForm} className={btnCancel}>Cancel</button>
          </div>
        </div>
      )}

      {teams.length === 0 && !isAddingTeam && (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-24">
          <div className="tw-w-14 tw-h-14 tw-bg-purps-500/5 tw-border tw-border-purps-500/10 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-mb-5">
            <svg className="tw-w-7 tw-h-7 tw-text-purps-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <p className="tw-text-grey-700 tw-text-sm tw-mb-1">No teams yet</p>
          <p className="tw-text-grey-500 tw-text-sm">Add your first team to get started.</p>
        </div>
      )}

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
        {teams.map((team, teamIdx) => {
          const isEditing = editingTeamId === team.id
          const engineers = engineersByTeam[team.id] || []
          const isLoadingEng = loadingEngineers[team.id]
          const tc = TEAM_COLORS[teamIdx % TEAM_COLORS.length]

          return (
            <div
              key={team.id}
              className={`tw-bg-white tw-border tw-border-grey-200 tw-rounded-xl tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-border-t-[3px] ${tc.topBorder}`}
            >
              {/* Team header */}
              <div className="tw-p-4 tw-flex tw-items-center tw-justify-between tw-group tw-border-b tw-border-grey-100">
                <div className="tw-flex tw-items-center tw-gap-3 tw-flex-1 tw-min-w-0">
                  {isEditing ? (
                    <div className="tw-flex tw-items-center tw-gap-2.5 tw-flex-1">
                      <input type="text" value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} onKeyDown={handleTeamKeyDown} autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                      <button onClick={saveTeam} className={btnPrimary + " tw-py-1.5"}>Save</button>
                      <button onClick={cancelTeamForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                    </div>
                  ) : (
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <div className={`tw-w-9 tw-h-9 tw-rounded-lg ${tc.bg} tw-border ${tc.border} tw-flex tw-items-center tw-justify-center tw-flex-shrink-0`}>
                        <svg className={`tw-w-4.5 tw-h-4.5 ${tc.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="tw-text-grey-900 tw-font-medium tw-text-sm">{team.name}</h3>
                        <p className="tw-text-grey-500 tw-text-xs tw-mt-0.5">{engineers.length} {engineers.length === 1 ? 'member' : 'members'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="tw-flex tw-items-center tw-gap-1 tw-ml-3 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
                    <button onClick={() => startEditTeam(team)} title="Edit team" className="tw-text-grey-400 hover:tw-text-purps-500 tw-transition-colors tw-p-1.5 tw-rounded-md hover:tw-bg-grey-100">
                      <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => deleteTeam(team.id)} title="Delete team" className="tw-text-grey-400 hover:tw-text-warningred-500 tw-transition-colors tw-p-1.5 tw-rounded-md hover:tw-bg-grey-100">
                      <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Engineers list - always visible */}
              <div className="tw-p-3 tw-bg-grey-50/50">
                {isLoadingEng ? (
                  <div className="tw-flex tw-items-center tw-gap-2 tw-py-3 tw-justify-center">
                    <div className="tw-w-4 tw-h-4 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
                    <p className="tw-text-grey-500 tw-text-xs">Loading...</p>
                  </div>
                ) : (
                  <>
                    {engineers.length === 0 && addingEngineerTeamId !== team.id && (
                      <p className="tw-text-grey-400 tw-text-xs tw-py-3 tw-text-center tw-italic">No members yet</p>
                    )}

                    <div className="tw-space-y-1.5">
                      {engineers.map((eng) => {
                        if (editingEngineerId === eng.id) {
                          return (
                            <div key={eng.id} className="tw-flex tw-items-center tw-gap-2 tw-py-2 tw-px-3 tw-bg-white tw-rounded-lg tw-border tw-border-grey-200">
                              <input type="text" value={engineerNameInput} onChange={(e) => setEngineerNameInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Name" autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                              <input type="text" value={engineerRoleInput} onChange={(e) => setEngineerRoleInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Role" className={inputClass + " tw-w-28 tw-py-1.5"} />
                              <button onClick={() => saveEngineer(team.id)} className={btnPrimary + " tw-py-1.5"}>Save</button>
                              <button onClick={cancelEngineerForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                            </div>
                          )
                        }
                        const noteText = (engineerNotes[eng.id] ?? eng.notes ?? '').trim()
                        const hasNotes = !!noteText
                        const isEditingNote = editingNoteEngId === eng.id
                        return (
                          <div key={eng.id} className="tw-bg-white tw-rounded-lg tw-border tw-border-grey-200 tw-overflow-hidden">
                            {/* Engineer info row */}
                            <div className="tw-flex tw-items-center tw-justify-between tw-py-2 tw-px-3 tw-group/eng">
                              <div className="tw-flex tw-items-center tw-gap-2.5">
                                <div className={`tw-w-6 tw-h-6 tw-rounded-full ${tc.bg} tw-flex tw-items-center tw-justify-center tw-flex-shrink-0`}>
                                  <svg className={`tw-w-3 tw-h-3 ${tc.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                  </svg>
                                </div>
                                <div className="tw-flex tw-items-center tw-gap-2">
                                  <span className="tw-text-grey-800 tw-text-sm tw-font-medium">{eng.name}</span>
                                  {eng.role && (
                                    <span className={`${tc.roleBg} ${tc.roleText} tw-text-[10px] tw-px-1.5 tw-py-0.5 tw-rounded tw-font-medium`}>{eng.role}</span>
                                  )}
                                </div>
                              </div>
                              <div className="tw-flex tw-items-center tw-gap-1 tw-opacity-0 group-hover/eng:tw-opacity-100 tw-transition-opacity">
                                <button onClick={() => startEditEngineer(eng)} title="Edit" className="tw-text-grey-400 hover:tw-text-purps-500 tw-transition-colors tw-p-1 tw-rounded-md hover:tw-bg-grey-100">
                                  <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                                <button onClick={() => deleteEngineer(eng.id, team.id)} title="Remove" className="tw-text-grey-400 hover:tw-text-warningred-500 tw-transition-colors tw-p-1 tw-rounded-md hover:tw-bg-grey-100">
                                  <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Notes area */}
                            <div className="tw-border-t tw-border-grey-100 tw-px-3 tw-py-1.5">
                              {isEditingNote ? (
                                <div>
                                  <textarea
                                    value={engineerNotes[eng.id] ?? eng.notes ?? ''}
                                    onChange={(e) => setEngineerNotes((prev) => ({ ...prev, [eng.id]: e.target.value }))}
                                    rows={2}
                                    placeholder={`Notes about ${eng.name}...`}
                                    autoFocus
                                    className={inputClass + " tw-w-full tw-resize-none tw-text-xs"}
                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingNoteEngId(null) }}
                                  />
                                  <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mt-1">
                                    <button
                                      onClick={() => setEditingNoteEngId(null)}
                                      className={btnCancel + " tw-py-1 tw-text-xs"}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => saveEngineerNotes(eng.id, team.id)}
                                      disabled={noteSaving[eng.id]}
                                      className={btnPrimary + " tw-py-1 tw-px-3 tw-text-xs disabled:tw-opacity-50"}
                                    >
                                      {noteSaving[eng.id] ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : hasNotes ? (
                                <div
                                  onClick={() => setEditingNoteEngId(eng.id)}
                                  className="tw-cursor-pointer tw-rounded tw-p-1 tw--m-1 hover:tw-bg-grey-50 tw-transition-colors tw-group/note"
                                >
                                  <p className="tw-text-xs tw-text-grey-500 tw-leading-relaxed tw-whitespace-pre-wrap">
                                    {noteText}
                                  </p>
                                  <span className="tw-text-[10px] tw-text-grey-300 tw-opacity-0 group-hover/note:tw-opacity-100 tw-transition-opacity tw-mt-0.5 tw-block">
                                    Click to edit
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingNoteEngId(eng.id)}
                                  className="tw-text-xs tw-text-grey-400 hover:tw-text-purps-500 tw-transition-colors tw-italic tw-py-0.5"
                                >
                                  Add a note...
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Add engineer button / form */}
                    {addingEngineerTeamId === team.id ? (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2 tw-pt-2 tw-border-t tw-border-grey-200">
                        <input type="text" value={engineerNameInput} onChange={(e) => setEngineerNameInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Name" autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                        <input type="text" value={engineerRoleInput} onChange={(e) => setEngineerRoleInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Role" className={inputClass + " tw-w-28 tw-py-1.5"} />
                        <button onClick={() => saveEngineer(team.id)} className={btnPrimary + " tw-py-1.5"}>Save</button>
                        <button onClick={cancelEngineerForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startAddEngineer(team.id)}
                        className="tw-text-purps-500 hover:tw-text-purps-600 tw-text-xs tw-font-semibold tw-transition-colors tw-flex tw-items-center tw-gap-1 tw-mt-2 tw-pt-2 tw-border-t tw-border-grey-100 tw-w-full"
                      >
                        <svg className="tw-w-3 tw-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Member
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
