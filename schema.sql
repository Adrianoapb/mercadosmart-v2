CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  version TEXT,
  updated_at TEXT NOT NULL
);
