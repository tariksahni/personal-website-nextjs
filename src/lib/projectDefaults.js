/**
 * Project stage definitions for the EM Command Center project tracker.
 *
 * Flow: Planning → Handoff → EDD → Implementation → Review → QA → Live
 */

export const STAGES = [
  { id: 'planning', label: 'Planning', description: 'Define requirements, scope, and timeline. Align with stakeholders.' },
  { id: 'handoff', label: 'Handoff', description: 'PRD and design handoff to engineering. Clarify specs and edge cases.' },
  { id: 'edd', label: 'EDD', description: 'Engineering Design Document — technical approach, schema, and architecture.' },
  { id: 'implementation', label: 'Implementation', description: 'Build the feature — code, data events, localisation, and integration.' },
  { id: 'review', label: 'Review', description: 'Code review, PR feedback, and iteration.' },
  { id: 'qa', label: 'QA', description: 'Design QA, functional QA, and data QA sign-off.' },
  { id: 'live', label: 'Live', description: 'Deployed to production. Smoke tested and stakeholders notified.' },
]

/**
 * Returns the index of a stage in the STAGES array.
 * Returns -1 if the stage id is not found.
 */
export function getStageIndex(stageId) {
  return STAGES.findIndex((s) => s.id === stageId)
}

/**
 * Returns the next stage id after the given stage,
 * or null if already at the final stage ('live').
 */
export function getNextStage(stageId) {
  const idx = getStageIndex(stageId)
  if (idx === -1 || idx >= STAGES.length - 1) return null
  return STAGES[idx + 1].id
}
