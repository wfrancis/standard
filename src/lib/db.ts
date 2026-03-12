import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const DB_PATH = process.env.NODE_ENV === 'production'
    ? '/data/standard-interiors.db'
    : path.join(process.cwd(), 'data', 'standard-interiors.db');

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gc_name TEXT,
      gc_estimator TEXT,
      gc_email TEXT,
      bid_date TEXT,
      bid_time TEXT,
      status TEXT DEFAULT 'active',
      bid_summary_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      page_number INTEGER,
      sheet_id TEXT,
      sheet_title TEXT,
      discipline TEXT,
      relevance TEXT,
      flooring_notes TEXT,
      detail_types TEXT,
      phase TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS specs (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      extraction_json TEXT,
      source_pages TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      project_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payload_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      locked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES agent_jobs(id),
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_tracking (
      uid TEXT PRIMARY KEY,
      message_id TEXT,
      subject TEXT,
      from_address TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      job_id TEXT
    );
  `);

  return _db;
}

// --- Helper functions ---

export function saveDrawings(projectId: string, classifications: Array<{
  pageNumber: number;
  sheetId: string;
  sheetTitle?: string | null;
  discipline: string;
  relevanceToFlooring: string;
  flooringNotes?: string | null;
  detailTypes?: string[] | null;
  phase?: string | null;
}>) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO drawings (id, project_id, page_number, sheet_id, sheet_title, discipline, relevance, flooring_notes, detail_types, phase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((items: typeof classifications) => {
    for (const c of items) {
      stmt.run(
        `${projectId}-p${c.pageNumber}`,
        projectId,
        c.pageNumber,
        c.sheetId,
        c.sheetTitle || null,
        c.discipline,
        c.relevanceToFlooring,
        c.flooringNotes || null,
        c.detailTypes ? JSON.stringify(c.detailTypes) : null,
        c.phase || null
      );
    }
  });
  insertMany(classifications);
}

export function getDrawingsByProject(projectId: string) {
  return getDb()
    .prepare('SELECT * FROM drawings WHERE project_id = ? ORDER BY page_number')
    .all(projectId);
}

export function saveSpec(projectId: string, extraction: Record<string, unknown>) {
  const db = getDb();
  const id = `${projectId}-spec-${Date.now()}`;
  db.prepare(
    `INSERT INTO specs (id, project_id, extraction_json) VALUES (?, ?, ?)`
  ).run(id, projectId, JSON.stringify(extraction));
  return id;
}

export function getSpecsByProject(projectId: string) {
  return getDb()
    .prepare('SELECT * FROM specs WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId);
}

export function getProjectWithCounts(projectId: string) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  const drawingCount = (db.prepare('SELECT COUNT(*) as count FROM drawings WHERE project_id = ?').get(projectId) as { count: number }).count;
  const specCount = (db.prepare('SELECT COUNT(*) as count FROM specs WHERE project_id = ?').get(projectId) as { count: number }).count;
  return { ...(project as Record<string, unknown>), drawingCount, specCount };
}

export function getProjectsWithCounts(status: string) {
  const db = getDb();
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM drawings WHERE project_id = p.id) as drawing_count,
      (SELECT COUNT(*) FROM specs WHERE project_id = p.id) as spec_count
    FROM projects p
    WHERE p.status = ?
    ORDER BY CASE WHEN p.bid_date IS NULL THEN 1 ELSE 0 END, p.bid_date ASC
  `).all(status);
}

export function updateProject(
  projectId: string,
  fields: {
    name?: string;
    gc_name?: string | null;
    gc_estimator?: string | null;
    gc_email?: string | null;
    bid_date?: string | null;
    bid_time?: string | null;
    status?: string;
    bid_summary_json?: string;
  }
) {
  const db = getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push("updated_at = datetime('now')");
  values.push(projectId);

  db.prepare(
    `UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`
  ).run(...values);

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

export default getDb;
