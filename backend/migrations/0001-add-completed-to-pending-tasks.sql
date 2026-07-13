ALTER TABLE pending_tasks ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pending_tasks ADD COLUMN completed_at TEXT;
