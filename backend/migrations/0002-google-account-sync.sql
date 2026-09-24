-- Google account-isolated sync. Legacy sync_records, user_data, pending_tasks,
-- and telegram_users remain untouched and in a separate namespace.
CREATE TABLE IF NOT EXISTS account_sessions (
  session_hash TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_account_sessions_user
  ON account_sessions(user_sub, expires_at);

CREATE TABLE IF NOT EXISTS account_sync_records (
  user_sub TEXT NOT NULL,
  record_key TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('task', 'category', 'settings')),
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL,
  PRIMARY KEY (user_sub, record_key)
);

CREATE INDEX IF NOT EXISTS idx_account_sync_records_user_revision
  ON account_sync_records(user_sub, revision);

CREATE TABLE IF NOT EXISTS account_sync_changes (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  user_sub TEXT NOT NULL,
  record_key TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('task', 'category', 'settings')),
  record_id TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at INTEGER NOT NULL,
  source_device TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_account_sync_changes_user_revision
  ON account_sync_changes(user_sub, revision);

CREATE TABLE IF NOT EXISTS account_legacy_claims (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  target_sub TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'failed', 'complete')),
  record_count INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
