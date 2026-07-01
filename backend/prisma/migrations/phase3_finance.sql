-- Phase 3: Finance Intelligence module (run if not using prisma migrate)
-- Adds transaction statement upload batches + parsed transaction records.

CREATE TYPE upload_status AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE txn_direction AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE txn_mode AS ENUM ('BANK', 'UPI', 'CASH', 'WALLET', 'NEFT', 'RTGS', 'IMPS');

CREATE TABLE IF NOT EXISTS finance_upload_batches (
  id              BIGSERIAL PRIMARY KEY,
  uploaded_by     BIGINT NOT NULL REFERENCES users(id),
  offender_id     BIGINT NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
  file_name       VARCHAR(500) NOT NULL,
  file_type       VARCHAR(20) NOT NULL,
  statement_month DATE NOT NULL,
  bank_name       VARCHAR(150),
  account_no      VARCHAR(50),
  upi_id          VARCHAR(150),
  total_records   INT NOT NULL DEFAULT 0,
  status          upload_status NOT NULL DEFAULT 'PROCESSING',
  error_log       TEXT,
  created_at      TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fub_offender ON finance_upload_batches(offender_id);
CREATE INDEX IF NOT EXISTS idx_fub_uploader ON finance_upload_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fub_status ON finance_upload_batches(status);
CREATE INDEX IF NOT EXISTS idx_fub_month ON finance_upload_batches(statement_month);

CREATE TABLE IF NOT EXISTS transaction_records (
  id                   BIGSERIAL PRIMARY KEY,
  batch_id             BIGINT NOT NULL REFERENCES finance_upload_batches(id) ON DELETE CASCADE,
  offender_id          BIGINT NOT NULL REFERENCES offenders(id) ON DELETE CASCADE,
  bank_name            VARCHAR(150),
  account_no           VARCHAR(50),
  upi_id               VARCHAR(150),
  transaction_ref      VARCHAR(100),
  amount               DECIMAL(12,2) NOT NULL,
  txn_date             DATE NOT NULL,
  direction            txn_direction NOT NULL DEFAULT 'OUTGOING',
  txn_mode             txn_mode NOT NULL DEFAULT 'BANK',
  counterparty_name    VARCHAR(200),
  counterparty_account VARCHAR(100),
  narration            VARCHAR(500),
  balance_after        DECIMAL(12,2),
  is_flagged           BOOLEAN NOT NULL DEFAULT false,
  flag_reason          VARCHAR(500),
  matched_offender_id  BIGINT REFERENCES offenders(id),
  notes                TEXT,
  created_at           TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_txn_batch ON transaction_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_txn_offender ON transaction_records(offender_id);
CREATE INDEX IF NOT EXISTS idx_txn_matched ON transaction_records(matched_offender_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transaction_records(txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_flagged ON transaction_records(is_flagged);
CREATE INDEX IF NOT EXISTS idx_txn_cp_account ON transaction_records(counterparty_account);
CREATE INDEX IF NOT EXISTS idx_txn_amount ON transaction_records(amount);
