-- ============================================
-- BOOST BOSS — AI Team Shared Memory
-- Run this in the Supabase SQL Editor.
-- The product DB stays the system of record; these tables are the team's working memory.
-- Conventions match supabase-schema.sql (UUID PK, TIMESTAMPTZ now()).
-- ============================================

-- ── Prospects ──
-- People discovered BEFORE they're customers. The Benna antenna's address book.
CREATE TABLE IF NOT EXISTS prospects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,                       -- 'product_hunt','mcp_registry','github','x','inbound'
  handle       TEXT,                                -- social handle / username
  name         TEXT,
  email        TEXT,
  company      TEXT,
  product_url  TEXT,
  segment      TEXT DEFAULT 'unknown' CHECK (segment IN ('supply','demand','unknown')),
  stage        TEXT DEFAULT 'discovered'
               CHECK (stage IN ('discovered','engaged','contacted','replied','signed_up','customer','lost')),
  intent_score NUMERIC(5,2),                        -- Benna score; NULL until scored (capture now, score later)
  context      JSONB DEFAULT '{}',                  -- what they build, why they fit, notes
  owner_agent  TEXT,                                -- which agent currently owns the relationship
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Intent events ──
-- Every signal across the journey: cold (stranger) → conversion (what turned them) → resident (in-product).
CREATE TABLE IF NOT EXISTS intent_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                        -- 'post_engaged','email_opened','reply','dm','signup','in_product'
  distance    TEXT DEFAULT 'cold' CHECK (distance IN ('cold','conversion','resident')),
  channel     TEXT,                                 -- 'x','email','linkedin','site'
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Action queue (THE APPROVAL GATE) ──
-- Irreversible actions wait here for the Chairman's tap. See GATES.md.
CREATE TABLE IF NOT EXISTS action_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent        TEXT NOT NULL,                       -- proposing agent
  action_type  TEXT NOT NULL,                       -- 'email_send','dm_send','payout','deploy','spend'
  summary      TEXT NOT NULL,                       -- one-liner for the brief
  detail       JSONB DEFAULT '{}',                  -- full payload to execute on approval
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','executed','expired')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  decided_by   TEXT
);

-- ── Agent activity (standup log) ──
-- What each agent did each cycle; Hermes reads this to compile the morning brief.
CREATE TABLE IF NOT EXISTS agent_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent      TEXT NOT NULL,
  cycle      DATE DEFAULT current_date,
  summary    TEXT NOT NULL,
  metrics    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_stage   ON prospects(stage);
CREATE INDEX IF NOT EXISTS idx_prospects_segment ON prospects(segment);
CREATE INDEX IF NOT EXISTS idx_intent_prospect   ON intent_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_action_status     ON action_queue(status);
CREATE INDEX IF NOT EXISTS idx_activity_cycle    ON agent_activity(cycle);
