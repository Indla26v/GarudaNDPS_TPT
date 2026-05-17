-- =============================================================
-- GARUDA — Migration: RBAC + Deletion Approval Chain
-- =============================================================
-- Run this migration against the garuda_db to:
-- 1. Update user_role enum (ADMIN, SP, DSP, CI, SI, CONSTABLE)
-- 2. Create deletion_requests table
-- 3. Create edit_requests table
-- 4. Add new audit_action enum values
-- 5. Add details column to audit_logs
-- =============================================================

BEGIN;

-- ── Step 1: Update user_role enum ─────────────────────────────────────
-- Remove old values and add new ones
-- Note: PostgreSQL does not allow removing enum values, so we recreate

-- First, rename old enum
ALTER TYPE user_role RENAME TO user_role_old;

-- Create new enum
CREATE TYPE user_role AS ENUM ('ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE');

-- Map old roles to new roles and update users table
-- SHO -> DSP, FIELD_OFFICER -> SI, READ_ONLY -> CONSTABLE, DATA_ENTRY -> CONSTABLE
ALTER TABLE users ALTER COLUMN role TYPE user_role USING (
  CASE role::text
    WHEN 'ADMIN' THEN 'ADMIN'::user_role
    WHEN 'SP' THEN 'SP'::user_role
    WHEN 'DSP' THEN 'DSP'::user_role
    WHEN 'SHO' THEN 'DSP'::user_role
    WHEN 'FIELD_OFFICER' THEN 'SI'::user_role
    WHEN 'READ_ONLY' THEN 'CONSTABLE'::user_role
    WHEN 'DATA_ENTRY' THEN 'CONSTABLE'::user_role
    ELSE 'CONSTABLE'::user_role
  END
);

-- Drop old enum
DROP TYPE user_role_old;


-- ── Step 2: Create deletion_request_status enum ──────────────────────
CREATE TYPE deletion_request_status AS ENUM (
  'FLAGGED', 'ESCALATED', 'REQUESTED', 'APPROVED', 'DELETED', 'REJECTED'
);


-- ── Step 3: Create edit_request_status enum ──────────────────────────
CREATE TYPE edit_request_status AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED'
);


-- ── Step 4: Add new audit_action values ──────────────────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_FLAGGED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_ESCALATED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_REQUESTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_APPROVED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_EXECUTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'DELETION_REJECTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'EDIT_REQUESTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'EDIT_APPROVED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'EDIT_REJECTED';


-- ── Step 5: Add details column to audit_logs ─────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;


-- ── Step 6: Create deletion_requests table ───────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id               BIGSERIAL PRIMARY KEY,
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        BIGINT NOT NULL,
  reason           TEXT,
  status           deletion_request_status NOT NULL DEFAULT 'FLAGGED',

  flagged_by       BIGINT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  flagged_at       TIMESTAMP(6) NOT NULL DEFAULT NOW(),

  escalated_by     BIGINT REFERENCES users(id) ON DELETE NO ACTION,
  escalated_at     TIMESTAMP(6),

  requested_by     BIGINT REFERENCES users(id) ON DELETE NO ACTION,
  requested_at     TIMESTAMP(6),

  approved_by      BIGINT REFERENCES users(id) ON DELETE NO ACTION,
  approved_at      TIMESTAMP(6),

  deleted_by       BIGINT REFERENCES users(id) ON DELETE NO ACTION,
  deleted_at       TIMESTAMP(6),

  rejection_reason TEXT,

  created_at       TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dr_status     ON deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_dr_entity     ON deletion_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dr_flagged_by ON deletion_requests(flagged_by);


-- ── Step 7: Create edit_requests table ───────────────────────────────
CREATE TABLE IF NOT EXISTS edit_requests (
  id               BIGSERIAL PRIMARY KEY,
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        BIGINT NOT NULL,
  changes_json     TEXT NOT NULL,
  reason           TEXT,
  status           edit_request_status NOT NULL DEFAULT 'PENDING',

  requested_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  requested_at     TIMESTAMP(6) NOT NULL DEFAULT NOW(),

  approved_by      BIGINT REFERENCES users(id) ON DELETE NO ACTION,
  approved_at      TIMESTAMP(6),

  rejection_reason TEXT,

  created_at       TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_er_status       ON edit_requests(status);
CREATE INDEX IF NOT EXISTS idx_er_entity       ON edit_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_er_requested_by ON edit_requests(requested_by);


COMMIT;
