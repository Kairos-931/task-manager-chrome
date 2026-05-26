CREATE TABLE IF NOT EXISTS pending_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  duration INTEGER DEFAULT 60,
  no_time_limit INTEGER DEFAULT 0,
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