-- Cloudflare D1 Migration: Add dedicated API key support for workers
-- 0002_worker_api_key.sql

ALTER TABLE workers ADD COLUMN api_key TEXT;
