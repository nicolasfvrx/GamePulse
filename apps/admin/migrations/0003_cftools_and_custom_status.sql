-- Cloudflare D1 Migration: CFTools Cloud integration and Custom Presence Status
ALTER TABLE bots ADD COLUMN query_type TEXT NOT NULL DEFAULT 'a2s';
ALTER TABLE bots ADD COLUMN cftools_server_id TEXT;
ALTER TABLE bots ADD COLUMN custom_status_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bots ADD COLUMN custom_status_text TEXT;
ALTER TABLE bots ADD COLUMN last_queue_size INTEGER DEFAULT 0;

ALTER TABLE server_status_logs ADD COLUMN queue_size INTEGER DEFAULT 0;
