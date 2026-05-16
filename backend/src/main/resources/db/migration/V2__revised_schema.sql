-- ============================================================
--  GARUDA · Anti-Drug Intelligence Platform
--  V2 — Revised Schema (Complete Proforma Alignment)
--  This migration restructures the schema:
--    - Offenders table slimmed to core identity
--    - Identity docs, contacts, financials, drug profile
--      broken out into separate one-to-many tables
--    - criminal_history table dropped (replaced by case_accused)
--    - surveillance_records and intelligence_inputs added
--    - All enum types updated to match proforma exactly
-- ============================================================

-- ===================== 1. NEW ENUM TYPES =====================

CREATE TYPE test_result AS ENUM ('POSITIVE', 'NEGATIVE', 'PENDING');
CREATE TYPE offender_status AS ENUM ('ACTIVE', 'INACTIVE', 'ABSCONDING', 'ARRESTED', 'BAILED');
CREATE TYPE risk_score AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE fin_type AS ENUM ('UPI_ID', 'UPI_LINKED_MOBILE', 'BANK_NAME', 'BANK_ACCOUNT_NO', 'IFSC_CODE', 'ATM_CARD');
CREATE TYPE addiction_type AS ENUM ('GANJA_ONLY', 'GANJA_ALCOHOL', 'GANJA_OTHER_DRUGS', 'MULTIPLE');
CREATE TYPE consumption_frequency AS ENUM ('DAILY', 'WEEKLY', 'OCCASIONAL');
CREATE TYPE source_of_procurement AS ENUM ('LOCAL', 'OUTSIDE_DISTRICT', 'ONLINE', 'COURIER');
CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT');
CREATE TYPE source_type AS ENUM ('INFORMER', 'FIELD_OFFICER', 'SB', 'EXCISE', 'OTHER');
CREATE TYPE verification_status AS ENUM ('PENDING', 'COMPLETED', 'MISSED');


-- ===================== 2. ALTER EXISTING ENUMS =====================

-- Add DATA_ENTRY to user_role
ALTER TYPE user_role ADD VALUE 'DATA_ENTRY';

-- Rename SUPPLIER → LOCAL_SUPPLIER in offender_category
ALTER TYPE offender_category RENAME VALUE 'SUPPLIER' TO 'LOCAL_SUPPLIER';

-- Rename OTHER → MIXED in purchase_mode
ALTER TYPE purchase_mode RENAME VALUE 'OTHER' TO 'MIXED';

-- Add BARTER value is already present, no change needed

-- Rebuild contact_type to match proforma Section 3 only
-- (Remove financial types — they go to offender_financials)
-- PostgreSQL doesn't support removing enum values, so we create new type
ALTER TYPE contact_type RENAME TO contact_type_old;
CREATE TYPE contact_type AS ENUM (
    'MOBILE_PRIMARY', 'MOBILE_SECONDARY', 'MOBILE_SIBLING',
    'GMAIL', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK',
    'OTHER_SOCIAL'
);

-- Rebuild supply_link_type (remove ASSOCIATE, OTHER)
ALTER TYPE supply_link_type RENAME TO supply_link_type_old;
CREATE TYPE supply_link_type AS ENUM (
    'CO_CONSUMER', 'PEDDLER', 'SUPPLIER', 'TRANSPORTER', 'KINGPIN'
);


-- ===================== 3. DROP OLD TABLES (order matters for FKs) =====================

-- Drop criminal_history (folded into case_accused now)
DROP TABLE IF EXISTS criminal_history CASCADE;

-- Drop old contacts (will be recreated as offender_contacts)
DROP TABLE IF EXISTS contacts CASCADE;

-- Drop supply_chain_links (will be recreated with new column names + enum)
DROP TABLE IF EXISTS supply_chain_links CASCADE;

-- Drop case_accused (will be recreated with new columns)
DROP TABLE IF EXISTS case_accused CASCADE;

-- Drop seizures (will be recreated with created_at)
DROP TABLE IF EXISTS seizures CASCADE;

-- Drop audit_logs (will be recreated with user_agent + enum action)
DROP TABLE IF EXISTS audit_logs CASCADE;


-- ===================== 4. ALTER OFFENDERS TABLE =====================
-- Remove fields that moved to separate tables

-- Remove drug profile columns (→ offender_drug_profile)
ALTER TABLE offenders DROP COLUMN IF EXISTS addiction_type;
ALTER TABLE offenders DROP COLUMN IF EXISTS consumption_frequency;
ALTER TABLE offenders DROP COLUMN IF EXISTS source_of_procurement;
ALTER TABLE offenders DROP COLUMN IF EXISTS mode_of_purchase;
ALTER TABLE offenders DROP COLUMN IF EXISTS usual_consumption_spot;

-- Remove identity doc columns (→ offender_identity_docs)
ALTER TABLE offenders DROP COLUMN IF EXISTS aadhaar_no;
ALTER TABLE offenders DROP COLUMN IF EXISTS voter_id;
ALTER TABLE offenders DROP COLUMN IF EXISTS pan_card;

-- Remove criminal history flags (→ cases / case_accused)
ALTER TABLE offenders DROP COLUMN IF EXISTS previous_crime_history;
ALTER TABLE offenders DROP COLUMN IF EXISTS history_sheet_status;

-- Remove is_active (replaced by status enum)
ALTER TABLE offenders DROP COLUMN IF EXISTS is_active;

-- Remove old test_result VARCHAR (will re-add as enum)
ALTER TABLE offenders DROP COLUMN IF EXISTS test_result;

-- Rename landmark → landmark_area
ALTER TABLE offenders RENAME COLUMN landmark TO landmark_area;

-- Add new columns
ALTER TABLE offenders ADD COLUMN test_result test_result;
ALTER TABLE offenders ADD COLUMN status offender_status NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE offenders ADD COLUMN risk_score risk_score;

-- Add index on status
CREATE INDEX idx_offenders_status ON offenders(status);
CREATE INDEX idx_offenders_risk   ON offenders(risk_score);

-- Drop old aadhaar index (column removed)
DROP INDEX IF EXISTS idx_offenders_aadhaar;


-- ===================== 5. ALTER CASES TABLE =====================

-- Remove ganja_quantity_kg (belongs to seizures)
ALTER TABLE cases DROP COLUMN IF EXISTS ganja_quantity_kg;

-- Add new columns
ALTER TABLE cases ADD COLUMN is_history_sheet BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN is_rowdy_sheet   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN updated_at       TIMESTAMP NOT NULL DEFAULT NOW();


-- ===================== 6. CREATE NEW TABLES =====================

-- 6a. offender_identity_docs (Section 5 of proforma)
CREATE TABLE offender_identity_docs (
    id          BIGSERIAL       PRIMARY KEY,
    offender_id BIGINT          NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    aadhaar_no  VARCHAR(12),
    voter_id    VARCHAR(30),
    pan_card    VARCHAR(10),
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oid_offender ON offender_identity_docs(offender_id);
CREATE INDEX idx_oid_aadhaar  ON offender_identity_docs(aadhaar_no);


-- 6b. offender_contacts (Section 3 — contact types only)
CREATE TABLE offender_contacts (
    id              BIGSERIAL       PRIMARY KEY,
    offender_id     BIGINT          NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    contact_type    contact_type    NOT NULL,
    value           VARCHAR(300)    NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oc_offender ON offender_contacts(offender_id);
CREATE INDEX idx_oc_value    ON offender_contacts(value);
CREATE INDEX idx_oc_type     ON offender_contacts(contact_type);


-- 6c. offender_financials (Section 4 — one row per financial instrument)
CREATE TABLE offender_financials (
    id          BIGSERIAL       PRIMARY KEY,
    offender_id BIGINT          NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    fin_type    fin_type        NOT NULL,
    value       VARCHAR(300)    NOT NULL,
    bank_name   VARCHAR(200),
    notes       TEXT,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_of_offender ON offender_financials(offender_id);
CREATE INDEX idx_of_type     ON offender_financials(fin_type);


-- 6d. offender_drug_profile (Section 7 — one profile per offender)
CREATE TABLE offender_drug_profile (
    id                      BIGSERIAL               PRIMARY KEY,
    offender_id             BIGINT                  NOT NULL UNIQUE REFERENCES offenders(id) ON DELETE CASCADE,
    addiction_type           addiction_type,
    consumption_frequency    consumption_frequency,
    source_of_procurement    source_of_procurement,
    mode_of_purchase         purchase_mode,
    usual_consumption_spot   VARCHAR(200),
    created_at              TIMESTAMP               NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP               NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odp_offender ON offender_drug_profile(offender_id);


-- 6e. supply_chain_links (Section 8 — recreated with new columns + enum)
CREATE TABLE supply_chain_links (
    id                      BIGSERIAL           PRIMARY KEY,
    offender_id             BIGINT              NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    link_type               supply_link_type    NOT NULL,
    linked_person_name      VARCHAR(200),
    linked_person_contact   VARCHAR(100),
    linked_offender_id      BIGINT              REFERENCES offenders(id),
    notes                   TEXT,
    created_at              TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scl_offender ON supply_chain_links(offender_id);
CREATE INDEX idx_scl_linked   ON supply_chain_links(linked_offender_id);
CREATE INDEX idx_scl_type     ON supply_chain_links(link_type);


-- 6f. case_accused (recreated with all proforma fields)
CREATE TABLE case_accused (
    id              BIGSERIAL       PRIMARY KEY,
    case_id         BIGINT          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    offender_id     BIGINT          NOT NULL REFERENCES offenders(id),
    previous_cr_no  VARCHAR(50),
    previous_ps_id  BIGINT          REFERENCES police_stations(id),
    arrest_status   arrest_status   NOT NULL DEFAULT 'ARRESTED',
    arrest_date     DATE,
    bail_date       DATE,
    bail_conditions TEXT,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    UNIQUE(case_id, offender_id)
);

CREATE INDEX idx_ca_case     ON case_accused(case_id);
CREATE INDEX idx_ca_offender ON case_accused(offender_id);


-- 6g. seizures (recreated with created_at)
CREATE TABLE seizures (
    id              BIGSERIAL       PRIMARY KEY,
    case_id         BIGINT          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    contraband_kg   DECIMAL(10, 3),
    vehicles_count  INTEGER         NOT NULL DEFAULT 0,
    cash_amount     DECIMAL(15, 2)  NOT NULL DEFAULT 0,
    parcels_count   INTEGER         NOT NULL DEFAULT 0,
    other_items     TEXT,
    seizure_date    DATE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seizures_case ON seizures(case_id);


-- 6h. surveillance_records (DPR Surveillance Module)
CREATE TABLE surveillance_records (
    id                  BIGSERIAL               PRIMARY KEY,
    offender_id         BIGINT                  NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    scheduled_date      DATE,
    verified_by         BIGINT                  REFERENCES users(id),
    verification_status verification_status     NOT NULL DEFAULT 'PENDING',
    current_address     TEXT,
    current_occupation  VARCHAR(200),
    associates_noted    TEXT,
    geo_lat             DECIMAL(10, 7),
    geo_lng             DECIMAL(10, 7),
    notes               TEXT,
    created_at          TIMESTAMP               NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sr_offender     ON surveillance_records(offender_id);
CREATE INDEX idx_sr_status       ON surveillance_records(verification_status);
CREATE INDEX idx_sr_date         ON surveillance_records(scheduled_date);
CREATE INDEX idx_sr_verified_by  ON surveillance_records(verified_by);


-- 6i. intelligence_inputs (DPR Intelligence Module)
CREATE TABLE intelligence_inputs (
    id              BIGSERIAL       PRIMARY KEY,
    offender_id     BIGINT          REFERENCES offenders(id),
    ps_id           BIGINT          NOT NULL REFERENCES police_stations(id),
    source_type     source_type     NOT NULL,
    input_text      TEXT,
    supply_route    TEXT,
    created_by      BIGINT          REFERENCES users(id),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ii_offender   ON intelligence_inputs(offender_id);
CREATE INDEX idx_ii_ps         ON intelligence_inputs(ps_id);
CREATE INDEX idx_ii_source     ON intelligence_inputs(source_type);
CREATE INDEX idx_ii_created_by ON intelligence_inputs(created_by);


-- 6j. audit_logs (recreated with user_agent + enum action)
CREATE TABLE audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          REFERENCES users(id),
    action          audit_action    NOT NULL,
    entity_type     VARCHAR(50)     NOT NULL,
    entity_id       BIGINT,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    timestamp       TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action    ON audit_logs(action);


-- ===================== 7. CLEANUP OLD ENUM TYPES =====================

DROP TYPE IF EXISTS contact_type_old;
DROP TYPE IF EXISTS supply_link_type_old;
