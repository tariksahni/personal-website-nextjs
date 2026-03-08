-- Add notes column to engineers table for per-member notepads
ALTER TABLE engineers ADD COLUMN IF NOT EXISTS notes text;
