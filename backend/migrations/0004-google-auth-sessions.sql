-- Short-lived OAuth flows and exchange codes plus finite, revocable
-- TaskMaster sessions. No Google access or refresh tokens are persisted.
CREATE TABLE IF NOT EXISTS google_auth_flows (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('extension', 'mobile')),
  code_challenge TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'processing', 'completed', 'failed', 'consumed')),
  consumed_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_auth_flows_expiry
  ON google_auth_flows(expires_at);

CREATE TABLE IF NOT EXISTS google_auth_codes (
  code_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  code_challenge TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_auth_codes_expiry
  ON google_auth_codes(expires_at);

CREATE TABLE IF NOT EXISTS google_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('extension', 'mobile')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_google_auth_sessions_expiry
  ON google_auth_sessions(expires_at);
