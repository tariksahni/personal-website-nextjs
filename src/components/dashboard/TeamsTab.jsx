import { useState, useEffect } from 'react'
import { supabase } from 'Lib/supabase'

export default function TeamsTab() {
  const [teams, setTeams] = useState([])
  const [engineersByTeam, setEngineersByTeam] = useState({})
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEngineers, setLoadingEngineers] = useState({})

  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [teamNameInput, setTeamNameInput] = useState('')

  const [addingEngineerTeamId, setAddingEngineerTeamId] = useState(null)
  const [editingEngineerId, setEditingEngineerId] = useState(null)
  const [engineerNameInput, setEngineerNameInput] = useState('')
  const [engineerRoleInput, setEngineerRoleInput] = useState('')

  useEffect(() => { fetchTeams() }, [])

  async function fetchTeams() {
    setLoadingTeams(true)
    const { data, error } = await supabase.from('teams').select('*').order('created_at')
    if (error) { setTeams([]); setLoadingTeams(false); return }
    setTeams(data || [])
    const counts = {}
    for (const team of data || []) {
      const { count } = await supabase.from('engineers').select('*', { count: 'exact', head: true }).eq('team_id', team.id)
      counts[team.id] = count || 0
    }
    setEngineersByTeam((prev) => {
      const next = { ...prev }
      for (const [teamId, count] of Object.entries(counts)) {
        next[teamId] = next[teamId] ? { ...next[teamId], count } : { count, engineers: [] }
      }
      return next
    })
    setLoadingTeams(false)
  }

  async function fetchEngineers(teamId) {
    setLoadingEngineers((prev) => ({ ...prev, [teamId]: true }))
    const { data } = await supabase.from('engineers').select('*').eq('team_id', teamId).order('name')
    setEngineersByTeam((prev) => ({ ...prev, [teamId]: { count: (data || []).length, engineers: data || [] } }))
    setLoadingEngineers((prev) => ({ ...prev, [teamId]: false }))
  }

  function handleExpandTeam(teamId) {
    if (expandedTeamId === teamId) { setExpandedTeamId(null); return }
    setExpandedTeamId(teamId)
    fetchEngineers(teamId)
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
    if (expandedTeamId === teamId) setExpandedTeamId(null)
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
    cancelEngineerForm(); await fetchEngineers(teamId); await fetchTeams()
  }

  async function deleteEngineer(engineerId, teamId) {
    if (!window.confirm('Remove this engineer?')) return
    await supabase.from('engineers').delete().eq('id', engineerId)
    await fetchEngineers(teamId); await fetchTeams()
  }

  function handleTeamKeyDown(e) { if (e.key === 'Enter') saveTeam(); if (e.key === 'Escape') cancelTeamForm() }
  function handleEngineerKeyDown(e, teamId) { if (e.key === 'Enter') saveEngineer(teamId); if (e.key === 'Escape') cancelEngineerForm() }

  const inputClass = "tw-bg-white tw-border tw-border-grey-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-grey-900 tw-text-sm tw-placeholder-grey-400 focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all"
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
          <h2 className="tw-text-lg tw-font-semibold tw-text-grey-900">Teams</h2>
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
          <div className="tw-w-14 tw-h-14 tw-bg-white tw-border tw-border-grey-200 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-mb-5 tw-shadow-sm">
            <span className="tw-text-grey-400 tw-text-xl">+</span>
          </div>
          <p className="tw-text-grey-700 tw-text-sm tw-mb-1">No teams yet</p>
          <p className="tw-text-grey-500 tw-text-sm">Add your first team to get started.</p>
        </div>
      )}

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
        {teams.map((team) => {
          const isExpanded = expandedTeamId === team.id
          const isEditing = editingTeamId === team.id
          const teamData = engineersByTeam[team.id]
          const engineerCount = teamData?.count || 0
          const engineers = teamData?.engineers || []
          const isLoadingEng = loadingEngineers[team.id]

          return (
            <div
              key={team.id}
              className={`tw-bg-white tw-border tw-rounded-xl tw-transition-all tw-overflow-hidden tw-shadow-sm ${
                isExpanded
                  ? 'tw-border-purps-300 tw-shadow-md md:tw-col-span-2 lg:tw-col-span-3'
                  : 'tw-border-grey-200 hover:tw-border-grey-300 hover:tw-shadow-md'
              }`}
            >
              <div
                className={`tw-p-4 tw-flex tw-items-center tw-justify-between tw-group ${!isEditing ? 'tw-cursor-pointer' : ''}`}
                onClick={() => { if (!isEditing) handleExpandTeam(team.id) }}
              >
                <div className="tw-flex tw-items-center tw-gap-3.5 tw-flex-1 tw-min-w-0">
                  {isEditing ? (
                    <div className="tw-flex tw-items-center tw-gap-2.5 tw-flex-1" onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} onKeyDown={handleTeamKeyDown} autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                      <button onClick={saveTeam} className={btnPrimary + " tw-py-1.5"}>Save</button>
                      <button onClick={cancelTeamForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                    </div>
                  ) : (
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <div className="tw-w-9 tw-h-9 tw-rounded-lg tw-bg-purps-20 tw-border tw-border-purps-50 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0">
                        <span className="tw-text-purps-500 tw-text-xs tw-font-bold">{team.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="tw-text-grey-900 tw-font-medium tw-text-sm">{team.name}</h3>
                        <p className="tw-text-grey-500 tw-text-xs tw-mt-0.5">{engineerCount} {engineerCount === 1 ? 'member' : 'members'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="tw-flex tw-items-center tw-gap-1 tw-ml-3 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startEditTeam(team)} title="Edit team" className="tw-text-grey-400 hover:tw-text-purps-500 tw-transition-colors tw-p-1.5 tw-rounded-md hover:tw-bg-grey-100">
                      <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => deleteTeam(team.id)} title="Delete team" className="tw-text-grey-400 hover:tw-text-warningred-500 tw-transition-colors tw-p-1.5 tw-rounded-md hover:tw-bg-grey-100">
                      <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                )}

                {!isEditing && (
                  <div className="tw-ml-2">
                    <svg className={`tw-w-4 tw-h-4 tw-text-grey-400 tw-transition-transform tw-duration-200 ${isExpanded ? 'tw-rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="tw-border-t tw-border-grey-100 tw-p-4 tw-bg-grey-50">
                  {isLoadingEng ? (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-py-4 tw-justify-center">
                      <div className="tw-w-4 tw-h-4 tw-border-2 tw-border-purps-100 tw-border-t-purps-500 tw-rounded-full tw-animate-spin" />
                      <p className="tw-text-grey-500 tw-text-sm">Loading...</p>
                    </div>
                  ) : (
                    <>
                      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                        <p className="tw-text-xs tw-font-semibold tw-text-grey-500 tw-uppercase tw-tracking-wider">Members ({engineers.length})</p>
                        {addingEngineerTeamId !== team.id && (
                          <button onClick={() => startAddEngineer(team.id)} className="tw-text-purps-500 hover:tw-text-purps-600 tw-text-xs tw-font-semibold tw-transition-colors tw-flex tw-items-center tw-gap-1">
                            <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Member
                          </button>
                        )}
                      </div>

                      {engineers.length === 0 && addingEngineerTeamId !== team.id && (
                        <p className="tw-text-grey-500 tw-text-sm tw-py-4 tw-text-center">No members yet. Add engineers to this team.</p>
                      )}

                      <div className="tw-space-y-1">
                        {engineers.map((eng) => {
                          if (editingEngineerId === eng.id) {
                            return (
                              <div key={eng.id} className="tw-flex tw-items-center tw-gap-2 tw-py-2 tw-px-3 tw-bg-white tw-rounded-lg tw-border tw-border-grey-200">
                                <input type="text" value={engineerNameInput} onChange={(e) => setEngineerNameInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Name" autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                                <input type="text" value={engineerRoleInput} onChange={(e) => setEngineerRoleInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Role" className={inputClass + " tw-w-36 tw-py-1.5"} />
                                <button onClick={() => saveEngineer(team.id)} className={btnPrimary + " tw-py-1.5"}>Save</button>
                                <button onClick={cancelEngineerForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                              </div>
                            )
                          }
                          return (
                            <div key={eng.id} className="tw-flex tw-items-center tw-justify-between tw-py-2 tw-px-3 tw-rounded-lg hover:tw-bg-white tw-transition-colors tw-group/eng">
                              <div className="tw-flex tw-items-center tw-gap-3">
                                <div className="tw-w-7 tw-h-7 tw-rounded-full tw-bg-purps-20 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0">
                                  <span className="tw-text-purps-600 tw-text-xs tw-font-semibold">{eng.name?.charAt(0)?.toUpperCase()}</span>
                                </div>
                                <span className="tw-text-grey-800 tw-text-sm">{eng.name}</span>
                                {eng.role && (
                                  <span className="tw-bg-grey-100 tw-text-grey-600 tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-md tw-border tw-border-grey-200">{eng.role}</span>
                                )}
                              </div>
                              <div className="tw-flex tw-items-center tw-gap-1 tw-opacity-0 group-hover/eng:tw-opacity-100 tw-transition-opacity">
                                <button onClick={() => startEditEngineer(eng)} title="Edit" className="tw-text-grey-400 hover:tw-text-purps-500 tw-transition-colors tw-p-1 tw-rounded-md hover:tw-bg-grey-100">
                                  <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                                <button onClick={() => deleteEngineer(eng.id, team.id)} title="Remove" className="tw-text-grey-400 hover:tw-text-warningred-500 tw-transition-colors tw-p-1 tw-rounded-md hover:tw-bg-grey-100">
                                  <svg className="tw-w-3.5 tw-h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {addingEngineerTeamId === team.id && (
                        <div className="tw-flex tw-items-center tw-gap-2 tw-mt-3 tw-pt-3 tw-border-t tw-border-grey-200">
                          <input type="text" value={engineerNameInput} onChange={(e) => setEngineerNameInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Name" autoFocus className={inputClass + " tw-flex-1 tw-py-1.5"} />
                          <input type="text" value={engineerRoleInput} onChange={(e) => setEngineerRoleInput(e.target.value)} onKeyDown={(e) => handleEngineerKeyDown(e, team.id)} placeholder="Role" className={inputClass + " tw-w-36 tw-py-1.5"} />
                          <button onClick={() => saveEngineer(team.id)} className={btnPrimary + " tw-py-1.5"}>Save</button>
                          <button onClick={cancelEngineerForm} className={btnCancel + " tw-py-1.5"}>Cancel</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
