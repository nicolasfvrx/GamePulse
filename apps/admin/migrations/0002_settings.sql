-- Cloudflare D1 Migration: Settings table for persistent configuration (admin password, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
