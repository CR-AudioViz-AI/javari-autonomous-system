-- ============================================================================
-- CR AudioViz AI - Autonomous System Tables Migration
-- ============================================================================
-- Run this in Supabase SQL Editor if tables don't exist
-- ============================================================================

-- 1. Activity Logs Table
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

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. Self-Healing Log Table
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

ALTER TABLE javari_self_healing_log ENABLE ROW LEVEL SECURITY;

-- 3. Learning Queue Table
CREATE TABLE IF NOT EXISTS javari_learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  learning_outcome JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_queue_processed ON javari_learning_queue(processed);
CREATE INDEX IF NOT EXISTS idx_learning_queue_priority ON javari_learning_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_learning_queue_created_at ON javari_learning_queue(created_at);

ALTER TABLE javari_learning_queue ENABLE ROW LEVEL SECURITY;

-- 4. Knowledge Base Table
CREATE TABLE IF NOT EXISTS javari_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  topic TEXT UNIQUE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  short_answer TEXT,
  source TEXT,
  source_url TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.80,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON javari_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON javari_knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON javari_knowledge_base USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON javari_knowledge_base(is_active) WHERE is_active = true;

ALTER TABLE javari_knowledge_base ENABLE ROW LEVEL SECURITY;

-- 5. Data Sources Table (for scrapers)
CREATE TABLE IF NOT EXISTS javari_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  fetch_frequency INTERVAL DEFAULT '1 hour',
  last_fetch TIMESTAMPTZ,
  next_fetch TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_active ON javari_data_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_data_sources_next_fetch ON javari_data_sources(next_fetch);

ALTER TABLE javari_data_sources ENABLE ROW LEVEL SECURITY;

-- 6. External Data Table
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

-- ============================================================================
-- RLS Policies (service role full access)
-- ============================================================================

DO $$ 
BEGIN
  -- Activity logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'service_role_activity_logs') THEN
    CREATE POLICY service_role_activity_logs ON activity_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Self healing log
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'javari_self_healing_log' AND policyname = 'service_role_self_healing') THEN
    CREATE POLICY service_role_self_healing ON javari_self_healing_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Learning queue
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'javari_learning_queue' AND policyname = 'service_role_learning_queue') THEN
    CREATE POLICY service_role_learning_queue ON javari_learning_queue FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Knowledge base
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'javari_knowledge_base' AND policyname = 'service_role_knowledge_base') THEN
    CREATE POLICY service_role_knowledge_base ON javari_knowledge_base FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Data sources
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'javari_data_sources' AND policyname = 'service_role_data_sources') THEN
    CREATE POLICY service_role_data_sources ON javari_data_sources FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- External data
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'javari_external_data' AND policyname = 'service_role_external_data') THEN
    CREATE POLICY service_role_external_data ON javari_external_data FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('activity_logs', 'javari_self_healing_log', 'javari_learning_queue', 'javari_knowledge_base', 'javari_data_sources', 'javari_external_data');
