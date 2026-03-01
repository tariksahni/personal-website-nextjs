/**
 * Project stage definitions and default checklist items
 * for the EM Command Center project tracker.
 *
 * Flow: Planning → Handoff → EDD → Implementation → Review → QA → Live
 */

export const STAGES = [
  { id: 'planning', label: 'Planning' },
  { id: 'handoff', label: 'Handoff' },
  { id: 'edd', label: 'EDD' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'review', label: 'Review' },
  { id: 'qa', label: 'QA' },
  { id: 'live', label: 'Live' },
]

export const DEFAULT_CHECKLIST_ITEMS = {
  planning: [
    'Requirements & scope defined',
    'Timeline estimated',
    'Stakeholder alignment done',
  ],
  handoff: [
    'PRD handoff complete',
    'Design handoff complete',
  ],
  edd: [
    'Engineering Design Document created',
    'EDD reviewed & approved',
  ],
  implementation: [
    'Feature branch created',
    'Core implementation done',
    'Data events integrated',
    'Localisation copies added',
  ],
  review: [
    'PR raised',
    'PR review done',
  ],
  qa: [
    'Design QA passed',
    'Functional QA passed',
    'Data QA passed',
  ],
  live: [
    'Deployed to production',
    'Smoke test passed',
    'Stakeholders notified',
  ],
}

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
