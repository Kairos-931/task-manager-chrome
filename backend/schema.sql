CREATE TABLE IF NOT EXISTS pending_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  duration INTEGER DEFAULT 60,
  no_time_limit INTEGER DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  source TEXT DEFAULT 'web',
  created_at TEXT DEFAULT (datetime('now')),
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_tasks(synced);

CREATE TABLE IF NOT EXISTS telegram_users (
  telegram_user_id INTEGER PRIMARY KEY,
  api_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_data (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Incremental cross-device sync. Records retain delete tombstones so an old
-- device cannot resurrect a task that was deleted elsewhere.
CREATE TABLE IF NOT EXISTS sync_records (
  record_key TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_changes (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_revision ON sync_changes(revision);

-- Google-account data uses a separate namespace from the legacy global API
-- token and Telegram tables. There is deliberately no automatic backfill.
CREATE TABLE IF NOT EXISTS account_sync_state (
  user_sub TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS account_sync_records (
  user_sub TEXT NOT NULL,
  record_key TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL,
  PRIMARY KEY (user_sub, record_key)
);

CREATE TABLE IF NOT EXISTS account_sync_changes (
  user_sub TEXT NOT NULL,
  revision INTEGER NOT NULL,
  record_key TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_sub, revision)
);

CREATE INDEX IF NOT EXISTS idx_account_sync_changes_user_revision
  ON account_sync_changes(user_sub, revision);

-- Temporary rows exist only inside a single atomic legacy claim batch.
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

-- Keeps an immutable ownership/audit trail even after a safe rollback.
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
