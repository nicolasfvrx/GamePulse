-- Cloudflare D1 Migration: Map Dictionary for DayZ Map Translations
CREATE TABLE IF NOT EXISTS map_dictionary (
  raw_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pre-seed standard DayZ maps with clean display names
INSERT OR IGNORE INTO map_dictionary (raw_name, display_name) VALUES
  ('chernarusplus', 'Chernarus'),
  ('chernarus', 'Chernarus'),
  ('enoch', 'Livonia'),
  ('namalsk', 'Namalsk'),
  ('takistanplus', 'Takistan+'),
  ('takistan', 'Takistan'),
  ('deerisle', 'Deer Isle'),
  ('rostow', 'Rostow'),
  ('esseker', 'Esseker'),
  ('valning', 'Välning'),
  ('banov', 'Banov'),
  ('pripyat', 'Pripyat'),
  ('chiemsee', 'Chiemsee'),
  ('melkart', 'Melkart'),
  ('arland', 'Arland'),
  ('everon', 'Everon'),
  ('sakhal', 'Sakhal'),
  ('anizay', 'Anizay'),
  ('barrington', 'Barrington'),
  ('iztek', 'Iztek'),
  ('alteria', 'Alteria'),
  ('archana', 'Archana');
