-- New Google-account data lives in a separate namespace. Existing global
-- sync_records and user_data rows remain untouched and cannot be claimed by
-- the first Google account that signs in.
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
