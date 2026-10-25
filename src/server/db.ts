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
  id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, created_at TEXT NOT NULL,
  soul_name TEXT NOT NULL DEFAULT 'Soul', soul_status TEXT NOT NULL DEFAULT 'alive',
  soul_max_purity_days INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS accountability_contacts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL, contact_email TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL, min_clean_days INTEGER NOT NULL,
  target_goal_days INTEGER NOT NULL, start_date TEXT NOT NULL, planned_end_date TEXT,
  status TEXT NOT NULL CHECK(status IN ('active','completed','failed')),
  deficit_days INTEGER NOT NULL DEFAULT 0, ended_at TEXT
);
CREATE TABLE IF NOT EXISTS events_log (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id TEXT REFERENCES cycles(id), event_type TEXT NOT NULL,
  reflection_text TEXT, ai_feedback TEXT, event_date TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offline_operations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation TEXT NOT NULL,
  payload TEXT NOT NULL, created_at TEXT NOT NULL, processed_at TEXT
);
`);
const addColumn = (table: string, column: string, definition: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
  }
};
addColumn("users", "soul_name", "TEXT NOT NULL DEFAULT 'Soul'");
addColumn("users", "soul_status", "TEXT NOT NULL DEFAULT 'alive'");
addColumn("users", "soul_max_purity_days", "INTEGER NOT NULL DEFAULT 0");
addColumn("cycles", "planned_end_date", "TEXT");
addColumn("events_log", "event_date", "TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle_per_user ON cycles(user_id) WHERE status = 'active'");
