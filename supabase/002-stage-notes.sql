-- Migration 002: Add stage_notes, dev assignments, and stage field on tasks
-- Run this in the Supabase SQL editor

-- Stage notes (per-stage notes as JSON: { "planning": "...", "handoff": "..." })
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage_notes jsonb DEFAULT '{}'::jsonb;

-- Primary and secondary dev assignments
ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_dev_id uuid REFERENCES engineers(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secondary_dev_id uuid REFERENCES engineers(id) ON DELETE SET NULL;

-- Stage field on tasks (so stage TODOs know which stage they belong to)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stage text;
