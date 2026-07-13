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
