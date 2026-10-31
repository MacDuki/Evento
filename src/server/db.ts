import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();
const file = process.env.DATABASE_FILE || "./data/abstinencia.sqlite";
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS souls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('alive','dead')),
  max_purity_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  died_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_alive_soul_per_user ON souls(user_id) WHERE status = 'alive';
CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  soul_id TEXT NOT NULL REFERENCES souls(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  min_clean_days INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','completed','failed')),
  final_clean_days INTEGER,
  deficit_days INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT,
  ended_at TEXT,
  next_cycle_id TEXT REFERENCES cycles(id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle_per_soul ON cycles(soul_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS unique_cycle_number_per_soul ON cycles(soul_id, cycle_number);
CREATE TABLE IF NOT EXISTS cycle_goals (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  goal_days INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accountability_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  soul_id TEXT REFERENCES souls(id) ON DELETE CASCADE,
  cycle_id TEXT REFERENCES cycles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  reflection_text TEXT,
  ai_feedback TEXT,
  event_date TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offline_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processed_at TEXT
);
`);
