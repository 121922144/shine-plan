-- Neon PostgreSQL schema for Shine Plan (fresh database).
-- Run once in Neon Console > SQL Editor before enabling /api/*.
-- The script is idempotent. No legacy Cloudflare D1 data is touched.

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_states (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  slots_json TEXT NOT NULL DEFAULT '[]',
  notes_json TEXT NOT NULL DEFAULT '[]',
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_time TEXT NOT NULL DEFAULT '20:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  last_sent TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_device_states_reminder_enabled
  ON device_states(reminder_enabled);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_success_at BIGINT,
  failure_count BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id
  ON push_subscriptions(device_id);

CREATE TABLE IF NOT EXISTS reminder_deliveries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at BIGINT,
  UNIQUE(device_id, local_date)
);

-- Verify after execution:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('devices', 'device_states', 'push_subscriptions', 'reminder_deliveries')
ORDER BY table_name;
