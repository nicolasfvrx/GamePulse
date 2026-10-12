-- Cloudflare D1 Migration: Initial Schema for GamePulse
-- 0001_initial.sql

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT 'unknown',
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'degraded'
  cpu_usage_percent REAL NOT NULL DEFAULT 0.0,
  ram_used_mb REAL NOT NULL DEFAULT 0.0,
  ram_total_mb REAL NOT NULL DEFAULT 0.0,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  active_bots_count INTEGER NOT NULL DEFAULT 0,
  api_key TEXT,
  last_heartbeat_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  discord_token TEXT NOT NULL,
  discord_client_id TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  server_query_port INTEGER NOT NULL DEFAULT 2305,
  server_game_port INTEGER,
  refresh_interval_secs INTEGER NOT NULL DEFAULT 20,
  worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'error', 'stopped'
  activity_format TEXT NOT NULL DEFAULT 'Joue à DayZ - {map} [{players}/{max_players}]',
  last_server_name TEXT,
  last_map_name TEXT,
  last_players_count INTEGER DEFAULT 0,
  last_max_players INTEGER DEFAULT 60,
  last_ping_ms INTEGER DEFAULT 0,
  last_is_online INTEGER DEFAULT 0,
  last_error TEXT,
  last_queried_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bots_worker_id ON bots(worker_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);

CREATE TABLE IF NOT EXISTS server_status_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  server_ip TEXT NOT NULL,
  query_port INTEGER NOT NULL,
  is_online INTEGER NOT NULL DEFAULT 0,
  server_name TEXT,
  map_name TEXT,
  players_count INTEGER DEFAULT 0,
  max_players INTEGER DEFAULT 60,
  ping_ms INTEGER DEFAULT 0,
  error TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_bot_id_recorded_at ON server_status_logs(bot_id, recorded_at DESC);
