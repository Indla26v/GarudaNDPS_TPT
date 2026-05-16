-- ============================================================
--  GARUDA · Anti-Drug Intelligence Platform
--  V1 — Core Schema (Phase 1 Data Foundation)
--  Database : garuda_db
--  Owner    : garuda_user
-- ============================================================

-- ===================== ENUM TYPES =====================

CREATE TYPE user_role AS ENUM (
    'ADMIN', 'SP', 'DSP', 'SHO', 'FIELD_OFFICER', 'READ_ONLY'
);

CREATE TYPE offender_category AS ENUM (
    'CONSUMER', 'LOCAL_PEDDLER', 'SUPPLIER', 'LOCAL_KINGPIN',
    'TRANSPORTER', 'INTERSTATE_KINGPIN'
);

CREATE TYPE gender_type AS ENUM (
    'MALE', 'FEMALE', 'OTHER'
);

CREATE TYPE contact_type AS ENUM (
    'MOBILE_1', 'MOBILE_2', 'SIBLING_MOBILE',
    'GMAIL', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK',
    'UPI_ID', 'UPI_MOBILE', 'BANK_ACCOUNT', 'BANK_NAME',
    'IFSC_CODE', 'ATM_CARD', 'IMEI'
);

CREATE TYPE case_stage AS ENUM (
    'FIR', 'CHARGESHEET', 'TRIAL', 'CONVICTED', 'ACQUITTED', 'CLOSED'
);

CREATE TYPE arrest_status AS ENUM (
    'ARRESTED', 'ABSCONDING', 'BAILED'
);

CREATE TYPE purchase_mode AS ENUM (
    'CASH', 'UPI', 'CREDIT', 'BARTER', 'OTHER'
);

CREATE TYPE supply_link_type AS ENUM (
    'CO_CONSUMER', 'ASSOCIATE', 'PEDDLER', 'SUPPLIER',
    'TRANSPORTER', 'KINGPIN', 'OTHER'
);


-- ===================== 1. POLICE STATIONS =====================

CREATE TABLE police_stations (
    id          BIGSERIAL       PRIMARY KEY,
    name        VARCHAR(200)    NOT NULL,
    district    VARCHAR(100)    NOT NULL,
    state       VARCHAR(100)    NOT NULL DEFAULT 'Andhra Pradesh',
    ps_code     VARCHAR(20)     NOT NULL UNIQUE,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ps_district ON police_stations(district);


-- ===================== 2. USERS =====================

CREATE TABLE users (
    id                  BIGSERIAL       PRIMARY KEY,
    username            VARCHAR(50)     NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,
    full_name           VARCHAR(200)    NOT NULL,
    role                user_role       NOT NULL,
    police_station_id   BIGINT          REFERENCES police_stations(id),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login          TIMESTAMP,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_ps   ON users(police_station_id);


-- ===================== 3. REFRESH TOKENS =====================
-- Stored in DB for revocation capabilities (logout / force-expire)

CREATE TABLE refresh_tokens (
    id          BIGSERIAL       PRIMARY KEY,
    user_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(512)    NOT NULL UNIQUE,
    expiry_date TIMESTAMP       NOT NULL,
    revoked     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_user    ON refresh_tokens(user_id);
CREATE INDEX idx_rt_token   ON refresh_tokens(token);


-- ===================== 4. OFFENDERS =====================

CREATE TABLE offenders (
    id                      BIGSERIAL           PRIMARY KEY,
    sl_no                   VARCHAR(50),
    ps_id                   BIGINT              NOT NULL REFERENCES police_stations(id),
    full_name               VARCHAR(200)        NOT NULL,
    alias                   VARCHAR(200),
    father_husband_name     VARCHAR(200),
    age                     INTEGER,
    gender                  gender_type,
    category                offender_category,

    -- Address
    full_address            TEXT,
    landmark                VARCHAR(200),
    district                VARCHAR(100),
    state                   VARCHAR(100),

    -- Occupation & Income
    occupation              VARCHAR(100),
    monthly_income          DECIMAL(12, 2),

    -- Drug Consumption Pattern
    addiction_type           VARCHAR(100),
    consumption_frequency    VARCHAR(50),
    source_of_procurement    VARCHAR(200),
    test_result              VARCHAR(50),

    -- Purchase Modus Operandi
    mode_of_purchase         purchase_mode,
    usual_consumption_spot   VARCHAR(200),

    -- Identity Documents
    aadhaar_no              VARCHAR(12),
    voter_id                VARCHAR(30),
    pan_card                VARCHAR(10),

    -- Photo
    photo_url               VARCHAR(500),

    -- Criminal History Flags
    previous_crime_history  BOOLEAN             NOT NULL DEFAULT FALSE,
    history_sheet_status    VARCHAR(50),

    -- Metadata
    is_active               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_by              BIGINT              REFERENCES users(id),
    created_at              TIMESTAMP           NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offenders_ps       ON offenders(ps_id);
CREATE INDEX idx_offenders_name     ON offenders(full_name);
CREATE INDEX idx_offenders_alias    ON offenders(alias);
CREATE INDEX idx_offenders_category ON offenders(category);
CREATE INDEX idx_offenders_district ON offenders(district);
CREATE INDEX idx_offenders_aadhaar  ON offenders(aadhaar_no);


-- ===================== 5. CONTACTS =====================
-- Covers: mobiles, social media, financial IDs, IMEI

CREATE TABLE contacts (
    id              BIGSERIAL       PRIMARY KEY,
    offender_id     BIGINT          NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    contact_type    contact_type    NOT NULL,
    value           VARCHAR(300)    NOT NULL,
    notes           TEXT
);

CREATE INDEX idx_contacts_offender  ON contacts(offender_id);
CREATE INDEX idx_contacts_value     ON contacts(value);
CREATE INDEX idx_contacts_type      ON contacts(contact_type);


-- ===================== 6. CASES =====================

CREATE TABLE cases (
    id              BIGSERIAL       PRIMARY KEY,
    fir_no          VARCHAR(50)     NOT NULL,
    ps_id           BIGINT          NOT NULL REFERENCES police_stations(id),
    section_of_law  VARCHAR(300),
    case_date       DATE,
    stage           case_stage      NOT NULL DEFAULT 'FIR',
    ganja_quantity_kg DECIMAL(10, 3),
    created_by      BIGINT          REFERENCES users(id),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_ps       ON cases(ps_id);
CREATE INDEX idx_cases_fir      ON cases(fir_no);
CREATE INDEX idx_cases_stage    ON cases(stage);
CREATE INDEX idx_cases_date     ON cases(case_date);


-- ===================== 7. CASE ACCUSED =====================

CREATE TABLE case_accused (
    id              BIGSERIAL       PRIMARY KEY,
    case_id         BIGINT          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    offender_id     BIGINT          NOT NULL REFERENCES offenders(id),
    arrest_status   arrest_status   NOT NULL DEFAULT 'ARRESTED',
    arrest_date     DATE,
    bail_date       DATE,

    UNIQUE(case_id, offender_id)
);

CREATE INDEX idx_ca_case     ON case_accused(case_id);
CREATE INDEX idx_ca_offender ON case_accused(offender_id);


-- ===================== 8. SEIZURES =====================

CREATE TABLE seizures (
    id              BIGSERIAL       PRIMARY KEY,
    case_id         BIGINT          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    contraband_kg   DECIMAL(10, 3),
    vehicles_count  INTEGER         NOT NULL DEFAULT 0,
    cash_amount     DECIMAL(15, 2)  NOT NULL DEFAULT 0,
    parcels_count   INTEGER         NOT NULL DEFAULT 0,
    other_items     TEXT,
    seizure_date    DATE
);

CREATE INDEX idx_seizures_case ON seizures(case_id);


-- ===================== 9. AUDIT LOGS =====================

CREATE TABLE audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          REFERENCES users(id),
    action          VARCHAR(50)     NOT NULL,
    entity_type     VARCHAR(50)     NOT NULL,
    entity_id       BIGINT,
    ip_address      VARCHAR(45),
    timestamp       TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);


-- ===================== 10. CRIMINAL HISTORY =====================
-- Previous case records for an offender (from proforma)

CREATE TABLE criminal_history (
    id                  BIGSERIAL       PRIMARY KEY,
    offender_id         BIGINT          NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    previous_cr_no      VARCHAR(50),
    previous_ps         VARCHAR(200),
    sections_of_law     VARCHAR(300),
    case_stage          VARCHAR(30),
    notes               TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crimhist_offender ON criminal_history(offender_id);


-- ===================== 11. SUPPLY CHAIN LINKS =====================
-- Intelligence-critical: maps consumer → peddler → supplier → kingpin

CREATE TABLE supply_chain_links (
    id                  BIGSERIAL           PRIMARY KEY,
    offender_id         BIGINT              NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
    linked_offender_id  BIGINT              REFERENCES offenders(id),
    link_type           supply_link_type    NOT NULL,
    linked_name         VARCHAR(200),
    linked_contact      VARCHAR(100),
    notes               TEXT,
    created_at          TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scl_offender ON supply_chain_links(offender_id);
CREATE INDEX idx_scl_linked   ON supply_chain_links(linked_offender_id);
CREATE INDEX idx_scl_type     ON supply_chain_links(link_type);


-- ===================== SEED DATA =====================
-- Default admin user (password: Admin@123 — BCrypt hash)
-- A few sample police stations for immediate testing

INSERT INTO police_stations (name, district, state, ps_code) VALUES
    ('SP Office',           'Alluri Sitharama Raju', 'Andhra Pradesh', 'SP-HQ'),
    ('Paderu PS',           'Alluri Sitharama Raju', 'Andhra Pradesh', 'ASR-001'),
    ('Araku Valley PS',     'Alluri Sitharama Raju', 'Andhra Pradesh', 'ASR-002'),
    ('Chintapalli PS',      'Alluri Sitharama Raju', 'Andhra Pradesh', 'ASR-003'),
    ('G Madugula PS',       'Alluri Sitharama Raju', 'Andhra Pradesh', 'ASR-004'),
    ('Narsipatnam PS',      'Alluri Sitharama Raju', 'Andhra Pradesh', 'ASR-005');

-- password = Admin@123
INSERT INTO users (username, password_hash, full_name, role, police_station_id, is_active)
VALUES (
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'System Administrator',
    'ADMIN',
    1,
    TRUE
);
