-- ============================================================================
-- CR AudioViz AI - Autonomous System Tables Migration
-- Version: 2.0
-- Updated: 2026-01-09
-- ============================================================================
-- Run this in Supabase SQL Editor if tables don't exist
-- ============================================================================

-- ============================================================================
-- 1. Activity Logs Table
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_component ON activity_logs(component);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_success ON activity_logs(success);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to activity_logs" ON activity_logs;
CREATE POLICY "Service role full access to activity_logs" ON activity_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. Self-Healing Log Table
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_self_healing_severity ON javari_self_healing_log(severity);
CREATE INDEX IF NOT EXISTS idx_self_healing_component ON javari_self_healing_log(component);
CREATE INDEX IF NOT EXISTS idx_self_healing_created_at ON javari_self_healing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_self_healing_resolved ON javari_self_healing_log(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_self_healing_auto_healed ON javari_self_healing_log(auto_healed);

ALTER TABLE javari_self_healing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to self_healing_log" ON javari_self_healing_log;
CREATE POLICY "Service role full access to self_healing_log" ON javari_self_healing_log
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. Knowledge Base Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  short_answer TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.80,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, topic)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON javari_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON javari_knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON javari_knowledge_base(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON javari_knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON javari_knowledge_base USING GIN(keywords);

ALTER TABLE javari_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to knowledge_base" ON javari_knowledge_base;
CREATE POLICY "Service role full access to knowledge_base" ON javari_knowledge_base
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. Learning Queue Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  content_type TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  learning_outcome JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_queue_processed ON javari_learning_queue(processed);
CREATE INDEX IF NOT EXISTS idx_learning_queue_priority ON javari_learning_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_learning_queue_source ON javari_learning_queue(source);
CREATE INDEX IF NOT EXISTS idx_learning_queue_created ON javari_learning_queue(created_at);

ALTER TABLE javari_learning_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to learning_queue" ON javari_learning_queue;
CREATE POLICY "Service role full access to learning_queue" ON javari_learning_queue
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. Data Sources Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  base_url TEXT,
  fetch_frequency INTERVAL DEFAULT '1 hour',
  last_fetch TIMESTAMPTZ,
  next_fetch TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_name ON javari_data_sources(name);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON javari_data_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_data_sources_next_fetch ON javari_data_sources(next_fetch);

ALTER TABLE javari_data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to data_sources" ON javari_data_sources;
CREATE POLICY "Service role full access to data_sources" ON javari_data_sources
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. External Data Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_external_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  data_type TEXT NOT NULL,
  content JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, data_type)
);

CREATE INDEX IF NOT EXISTS idx_external_data_source ON javari_external_data(source);
CREATE INDEX IF NOT EXISTS idx_external_data_type ON javari_external_data(data_type);

ALTER TABLE javari_external_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to external_data" ON javari_external_data;
CREATE POLICY "Service role full access to external_data" ON javari_external_data
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify tables exist:
-- 
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'activity_logs', 
--   'javari_self_healing_log',
--   'javari_knowledge_base',
--   'javari_learning_queue',
--   'javari_data_sources',
--   'javari_external_data'
-- );
-- ============================================================================
