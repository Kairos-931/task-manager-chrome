-- Internal, one-time legacy extension data claim workflow.
CREATE TABLE IF NOT EXISTS account_data_claim_staging (
  operation_id TEXT NOT NULL,
  row_type TEXT NOT NULL,
  record_key TEXT NOT NULL DEFAULT '',
  record_type TEXT,
  record_id TEXT,
  payload TEXT,
  deleted INTEGER,
  updated_at INTEGER,
  source_device TEXT,
  source_revision INTEGER,
  full_sync_value TEXT,
  full_sync_updated_at TEXT,
  PRIMARY KEY (operation_id, row_type, record_key)
);

CREATE TABLE IF NOT EXISTS account_data_claims (
  operation_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  source_snapshot_hash TEXT NOT NULL,
  records_hash TEXT NOT NULL,
  target_sub TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  owner_confirmation_ref TEXT NOT NULL,
  backup_reference TEXT NOT NULL,
  backup_sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  imported_revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applying', 'applied', 'rolled_back')),
  claimed_at TEXT NOT NULL,
  rollback_operator_id TEXT,
  rolled_back_at TEXT,
  rollback_revision INTEGER
);
