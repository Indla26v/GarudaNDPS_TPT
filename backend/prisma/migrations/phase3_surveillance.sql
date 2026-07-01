-- Phase 3: Technical Surveillance module (run if not using prisma migrate)
-- Adds tower dump match logs + social/messaging intelligence inputs.

CREATE TYPE intel_rating AS ENUM ('CONFIRMED', 'PROBABLE', 'UNVERIFIED');
CREATE TYPE intel_source AS ENUM ('INFORMER', 'TIP_OFF', 'INTERCEPT');

CREATE TABLE IF NOT EXISTS tower_match_logs (
  id            BIGSERIAL PRIMARY KEY,
  case_id       BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  mobile_number VARCHAR(20) NOT NULL,
  latitude      DECIMAL(10,7) NOT NULL,
  longitude     DECIMAL(10,7) NOT NULL,
  hit_time      TIMESTAMP(6) NOT NULL,
  cell_tower_id VARCHAR(100) NOT NULL,
  provider      VARCHAR(50),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tml_case ON tower_match_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_tml_mobile ON tower_match_logs(mobile_number);
CREATE INDEX IF NOT EXISTS idx_tml_time ON tower_match_logs(hit_time);

CREATE TABLE IF NOT EXISTS social_media_intel (
  id            BIGSERIAL PRIMARY KEY,
  offender_id   BIGINT NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
  platform      VARCHAR(50) NOT NULL,
  handle_or_url VARCHAR(500) NOT NULL,
  rating        intel_rating NOT NULL DEFAULT 'UNVERIFIED',
  notes         TEXT,
  created_by    BIGINT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_smi_offender ON social_media_intel(offender_id);
CREATE INDEX IF NOT EXISTS idx_smi_platform ON social_media_intel(platform);

CREATE TABLE IF NOT EXISTS messaging_intel (
  id          BIGSERIAL PRIMARY KEY,
  offender_id BIGINT NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
  platform    VARCHAR(50) NOT NULL,
  source_type intel_source NOT NULL DEFAULT 'TIP_OFF',
  disposition VARCHAR(100),
  input_text  TEXT NOT NULL,
  created_by  BIGINT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msi_offender ON messaging_intel(offender_id);
CREATE INDEX IF NOT EXISTS idx_msi_source ON messaging_intel(source_type);
