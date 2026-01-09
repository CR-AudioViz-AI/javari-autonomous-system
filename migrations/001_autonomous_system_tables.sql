-- ============================================================================
-- CR AudioViz AI - Autonomous System Tables Migration
-- ============================================================================
-- Run this in Supabase SQL Editor if tables don't exist
-- ============================================================================

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  component TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_component ON activity_logs(component);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_success ON activity_logs(success);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role full access
CREATE POLICY "Service role full access to activity_logs" ON activity_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Self-Healing Log Table (if not exists - may already exist as javari_self_healing_log)
CREATE TABLE IF NOT EXISTS javari_self_healing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  auto_healed BOOLEAN DEFAULT false,
  healing_action TEXT,
  healing_result TEXT,
  requires_human BOOLEAN DEFAULT false,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create indexes for javari_self_healing_log
CREATE INDEX IF NOT EXISTS idx_self_healing_severity ON javari_self_healing_log(severity);
CREATE INDEX IF NOT EXISTS idx_self_healing_component ON javari_self_healing_log(component);
CREATE INDEX IF NOT EXISTS idx_self_healing_created_at ON javari_self_healing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_self_healing_resolved ON javari_self_healing_log(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_self_healing_auto_healed ON javari_self_healing_log(auto_healed);

-- Enable RLS
ALTER TABLE javari_self_healing_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role full access
CREATE POLICY "Service role full access to self_healing_log" ON javari_self_healing_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify tables exist:
-- 
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('activity_logs', 'javari_self_healing_log');
-- ============================================================================
