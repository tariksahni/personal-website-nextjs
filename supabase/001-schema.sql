-- ============================================
-- EM Command Center — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Teams
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Engineers
CREATE TABLE engineers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  team_id     uuid REFERENCES teams(id) ON DELETE SET NULL,
  role        text,
  created_at  timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  team_id     uuid REFERENCES teams(id) ON DELETE SET NULL,
  stage       text NOT NULL DEFAULT 'planning',
  description text,
  priority    text DEFAULT 'normal',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Project Stage Checklist
CREATE TABLE project_checklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  stage       text NOT NULL,
  item        text NOT NULL,
  is_checked  boolean DEFAULT false,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Tasks (personal + project-linked)
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  category    text DEFAULT 'misc',
  priority    text DEFAULT 'normal',
  due_date    date,
  is_done     boolean DEFAULT false,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS)
-- Only authenticated users can access data
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users get full access
CREATE POLICY "Authenticated users full access" ON teams
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON engineers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON projects
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON project_checklist
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- Seed: 3 starter teams
-- ============================================

INSERT INTO teams (name) VALUES
  ('Selection & Checkout'),
  ('Apps'),
  ('Booking Management');
