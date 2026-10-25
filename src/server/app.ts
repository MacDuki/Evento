import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { coachReflection, notifyContacts } from "./services.js";
import { evaluateCycle, validateNewCycle } from "../domain/cycle.js";

const app = express();
app.use(cors());
app.use(express.json());
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const userId = (req: express.Request) => String(req.header("x-user-id") || "");
function requireUser(req: express.Request, res: express.Response): string | null {
  const value = userId(req);
  if (!value) { res.status(401).json({ error: "Falta x-user-id" }); return null; }
  return value;
}
const cycleBody = z.object({ minCleanDays: z.number().int().positive(), targetGoalDays: z.number().int().positive() });

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/users", (req, res) => {
  const parsed = z.object({ email: z.string().email().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = { id: id(), email: parsed.data.email || null, password_hash: null, created_at: now() };
  db.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (@id,@email,@password_hash,@created_at)").run(user);
  res.status(201).json(user);
});
app.get("/api/state", (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const cycles = db.prepare("SELECT * FROM cycles WHERE user_id=? ORDER BY cycle_number DESC").all(uid);
  const contacts = db.prepare("SELECT id,contact_name,contact_email FROM accountability_contacts WHERE user_id=?").all(uid);
  const soul = db.prepare("SELECT soul_name,soul_status,soul_max_purity_days FROM users WHERE id=?").get(uid);
  res.json({ cycles, contacts, soul });
});
app.post("/api/cycles", (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const parsed = cycleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const last = db.prepare("SELECT * FROM cycles WHERE user_id=? ORDER BY cycle_number DESC LIMIT 1").get(uid) as { cycle_number: number; min_clean_days: number } | undefined;
  const previousMax = Number((db.prepare("SELECT COALESCE(MAX(soul_max_purity_days), 0) AS value FROM users WHERE id=?").get(uid) as { value: number }).value);
  try { validateNewCycle(parsed.data.minCleanDays, parsed.data.targetGoalDays, previousMax); } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : "Ciclo inválido" });
  }
  const cycle = { id: id(), user_id: uid, cycle_number: (last?.cycle_number || 0) + 1, min_clean_days: parsed.data.minCleanDays, target_goal_days: parsed.data.targetGoalDays, start_date: now(), status: "active", deficit_days: 0 };
  db.prepare("INSERT INTO cycles (id,user_id,cycle_number,min_clean_days,target_goal_days,start_date,status,deficit_days) VALUES (@id,@user_id,@cycle_number,@min_clean_days,@target_goal_days,@start_date,@status,@deficit_days)").run(cycle);
  res.status(201).json(cycle);
});
app.post("/api/cycles/:cycleId/finish", async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const cycle = db.prepare("SELECT * FROM cycles WHERE id=? AND user_id=? AND status='active'").get(req.params.cycleId, uid) as { id: string; min_clean_days: number; target_goal_days: number; start_date: string; cycle_number: number } | undefined;
  if (!cycle) return res.status(404).json({ error: "Ciclo activo no encontrado" });
  const cleanDays = Math.max(0, Math.floor((Date.now() - Date.parse(cycle.start_date)) / 86400000));
  const previous = Number((db.prepare("SELECT soul_max_purity_days AS value FROM users WHERE id=?").get(uid) as { value: number }).value);
  const outcome = evaluateCycle({ previousCleanDays: previous, minCleanDays: cycle.min_clean_days, targetGoalDays: cycle.target_goal_days, cleanDays });
  const nextMin = outcome.nextMinCleanDays ?? cleanDays + 1;
  const transaction = db.transaction(() => {
    db.prepare("UPDATE users SET soul_max_purity_days=MAX(soul_max_purity_days, ?) WHERE id=?").run(cleanDays, uid);
    if (outcome.soulDies) {
      db.prepare("UPDATE users SET soul_status='dead' WHERE id=?").run(uid);
      db.prepare("UPDATE cycles SET status='failed', deficit_days=?, ended_at=? WHERE id=?").run(outcome.deficitDays, now(), cycle.id);
      db.prepare("INSERT INTO events_log (id,user_id,cycle_id,event_type,created_at) VALUES (?,?,?,?,?)").run(id(), uid, cycle.id, "soul_died", now());
    } else {
      db.prepare("UPDATE cycles SET status='completed', deficit_days=?, ended_at=? WHERE id=?").run(outcome.deficitDays, now(), cycle.id);
      db.prepare("INSERT INTO events_log (id,user_id,cycle_id,event_type,created_at) VALUES (?,?,?,?,?)").run(id(), uid, cycle.id, "cycle_consumed", now());
      db.prepare("INSERT INTO cycles (id,user_id,cycle_number,min_clean_days,target_goal_days,start_date,status,deficit_days) VALUES (?,?,?,?,?,?,?,?)")
        .run(id(), uid, cycle.cycle_number + 1, nextMin, cycle.target_goal_days, now(), "active", 0);
    }
  });
  transaction();
  if (outcome.soulDies) {
    const recipients = (db.prepare("SELECT contact_email FROM accountability_contacts WHERE user_id=?").all(uid) as { contact_email: string }[]).map(x => x.contact_email);
    await notifyContacts("Ciclo fallido", "El ciclo activo fue marcado como fallido.", recipients);
  }
  res.json({ cleanDays, ...outcome, nextMinCleanDays: outcome.soulDies ? null : nextMin, status: outcome.soulDies ? "failed" : "active" });
});
app.post("/api/cycles/:cycleId/admit-consumption", async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const cycle = db.prepare("SELECT * FROM cycles WHERE id=? AND user_id=? AND status='active'").get(req.params.cycleId, uid) as { id: string; min_clean_days: number; target_goal_days: number; start_date: string; cycle_number: number } | undefined;
  if (!cycle) return res.status(404).json({ error: "Ciclo activo no encontrado" });
  const cleanDays = Math.max(0, Math.floor((Date.now() - Date.parse(cycle.start_date)) / 86400000));
  const previous = Number((db.prepare("SELECT soul_max_purity_days AS value FROM users WHERE id=?").get(uid) as { value: number }).value);
  const outcome = evaluateCycle({ previousCleanDays: previous, minCleanDays: cycle.min_clean_days, targetGoalDays: cycle.target_goal_days, cleanDays });
  const nextMin = outcome.nextMinCleanDays ?? cleanDays + 1;
  db.transaction(() => {
    db.prepare("UPDATE users SET soul_max_purity_days=MAX(soul_max_purity_days, ?) WHERE id=?").run(cleanDays, uid);
    if (outcome.soulDies) {
      db.prepare("UPDATE users SET soul_status='dead' WHERE id=?").run(uid);
      db.prepare("UPDATE cycles SET status='failed', ended_at=? WHERE id=?").run(now(), req.params.cycleId);
    } else {
      db.prepare("UPDATE cycles SET status='completed', deficit_days=?, ended_at=? WHERE id=?").run(outcome.deficitDays, now(), req.params.cycleId);
      db.prepare("INSERT INTO cycles (id,user_id,cycle_number,min_clean_days,target_goal_days,start_date,status,deficit_days) VALUES (?,?,?,?,?,?,?,?)")
        .run(id(), uid, cycle.cycle_number + 1, nextMin, cycle.target_goal_days, now(), "active", outcome.deficitDays);
    }
    db.prepare("INSERT INTO events_log (id,user_id,cycle_id,event_type,created_at) VALUES (?,?,?,?,?)").run(id(), uid, req.params.cycleId, "consumption_admitted", now());
  })();
  const recipients = (db.prepare("SELECT contact_email FROM accountability_contacts WHERE user_id=?").all(uid) as { contact_email: string }[]).map(x => x.contact_email);
  if (outcome.soulDies) await notifyContacts("Consumo admitido", "La soul ha muerto y su historial se conserva.", recipients);
  res.json({ ok: true, cleanDays, soulStatus: outcome.soulDies ? "dead" : "alive", nextMinCleanDays: outcome.soulDies ? null : nextMin });
});
app.post("/api/soul/name", (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const parsed = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const soul = db.prepare("SELECT soul_status FROM users WHERE id=?").get(uid) as { soul_status: string } | undefined;
  if (!soul || soul.soul_status !== "alive") return res.status(422).json({ error: "La soul muerta no puede renombrarse" });
  db.prepare("UPDATE users SET soul_name=? WHERE id=?").run(parsed.data.name, uid);
  res.json({ name: parsed.data.name });
});
app.post("/api/soul/goal", (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const parsed = z.object({ targetGoalDays: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const cycle = db.prepare("SELECT id,status FROM cycles WHERE user_id=? AND status='active'").get(uid) as { id: string } | undefined;
  if (!cycle) return res.status(404).json({ error: "No hay un ciclo activo" });
  db.prepare("UPDATE cycles SET target_goal_days=? WHERE id=?").run(parsed.data.targetGoalDays, cycle.id);
  db.prepare("INSERT INTO events_log (id,user_id,cycle_id,event_type,created_at) VALUES (?,?,?,?,?)").run(id(), uid, cycle.id, "goal_changed", now());
  res.json({ ok: true });
});
app.post("/api/coach/reflection", async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const parsed = z.object({ cycleId: z.string().optional(), reflection: z.string().min(1).max(10000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const feedback = await coachReflection(parsed.data.reflection);
  db.prepare("INSERT INTO events_log (id,user_id,cycle_id,event_type,reflection_text,ai_feedback,created_at) VALUES (?,?,?,?,?,?,?)").run(id(), uid, parsed.data.cycleId || null, "reflection", parsed.data.reflection, feedback, now());
  res.json({ feedback });
});
app.post("/api/contacts", (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  const parsed = z.object({ name: z.string().min(1), email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const contact = { id: id(), user_id: uid, contact_name: parsed.data.name, contact_email: parsed.data.email, created_at: now() };
  db.prepare("INSERT INTO accountability_contacts (id,user_id,contact_name,contact_email,created_at) VALUES (@id,@user_id,@contact_name,@contact_email,@created_at)").run(contact);
  res.status(201).json(contact);
});
export default app;
