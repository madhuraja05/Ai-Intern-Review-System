import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'intern_system.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;
let SQL = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS interns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      current_task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      requirements TEXT NOT NULL, -- JSON array of requirements
      deliverables TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      sequence_order INTEGER NOT NULL,
      estimated_duration TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      reference_docs TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      intern_email TEXT NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, IN_PROGRESS, PASSED, NEEDS_CHANGES, PENDING_AT_INTERNSHIP_END
      assigned_at TEXT NOT NULL,
      passed_at TEXT,
      review_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(intern_email, task_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      intern_email TEXT NOT NULL,
      task_id TEXT NOT NULL,
      text_content TEXT,
      repo_url TEXT,
      evidence_notes TEXT,
      submitted_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      review_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      intern_id TEXT NOT NULL,
      intern_email TEXT NOT NULL,
      task_id TEXT NOT NULL,
      overall_decision TEXT NOT NULL, -- PASS, NEEDS_CHANGES, HUMAN_REVIEW_REQUIRED
      requirement_findings TEXT NOT NULL, -- JSON array of findings
      missing_functionality TEXT,
      mentor_feedback TEXT NOT NULL,
      internal_report TEXT NOT NULL,
      evaluator_mode TEXT NOT NULL, -- GEMINI, OPENAI, ANTHROPIC, DEMO_DETERMINISTIC
      confidence_notes TEXT,
      coordinator_override INTEGER NOT NULL DEFAULT 0,
      coordinator_notes TEXT,
      reviewed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_schedules (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      intern_email TEXT NOT NULL,
      task_id TEXT NOT NULL,
      review_date TEXT NOT NULL,
      review_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      meet_url TEXT,
      prep_instructions TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, COMPLETED, CANCELLED, OVERDUE
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      intern_email TEXT NOT NULL,
      admin_email TEXT,
      email_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      content_preview TEXT,
      status TEXT NOT NULL, -- SENT, FAILED, SIMULATED
      error_message TEXT,
      sent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coordinator_notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- HUMAN_REVIEW_REQUIRED, INTERNSHIP_END_PENDING, SYSTEM_ALERT
      intern_id TEXT,
      intern_email TEXT,
      task_id TEXT,
      message TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/**
 * Helper to query multiple rows: returns array of plain objects
 */
export async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Helper to query a single row: returns plain object or null
 */
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper to execute a mutation (INSERT, UPDATE, DELETE): saves DB to file
 */
export async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
  return { success: true };
}

/**
 * Transaction wrapper
 */
export async function transaction(callback) {
  const db = await getDb();
  try {
    db.run('BEGIN TRANSACTION;');
    const result = await callback(db);
    db.run('COMMIT;');
    saveDb();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}
