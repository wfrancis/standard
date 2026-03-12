import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { JobType, AgentJob, AgentLogEntry } from './types';

export function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  projectId?: string
): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO agent_jobs (id, type, project_id, status, payload_json)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(id, type, projectId || null, JSON.stringify(payload));
  return id;
}

export function dequeueJob(): AgentJob | null {
  const db = getDb();

  // Clear stale locks older than 5 minutes
  db.prepare(
    `UPDATE agent_jobs SET status = 'pending', locked_at = NULL, updated_at = datetime('now')
     WHERE status = 'running' AND locked_at < datetime('now', '-5 minutes')`
  ).run();

  // Atomically find and lock the oldest pending job
  const job = db.prepare(
    `SELECT * FROM agent_jobs
     WHERE status = 'pending' AND attempt < max_attempts
     ORDER BY created_at ASC LIMIT 1`
  ).get() as AgentJob | undefined;

  if (!job) return null;

  db.prepare(
    `UPDATE agent_jobs SET status = 'running', locked_at = datetime('now'), attempt = attempt + 1, updated_at = datetime('now')
     WHERE id = ?`
  ).run(job.id);

  return { ...job, status: 'running', attempt: job.attempt + 1 };
}

export function completeJob(jobId: string, result?: Record<string, unknown>): void {
  getDb().prepare(
    `UPDATE agent_jobs SET status = 'completed', result_json = ?, completed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(result ? JSON.stringify(result) : null, jobId);
}

export function failJob(jobId: string, errorMsg: string): void {
  const db = getDb();
  logAgent(jobId, 'error', errorMsg);

  const job = db.prepare('SELECT attempt, max_attempts FROM agent_jobs WHERE id = ?').get(jobId) as { attempt: number; max_attempts: number } | undefined;

  const newStatus = job && job.attempt >= job.max_attempts ? 'failed' : 'pending';

  db.prepare(
    `UPDATE agent_jobs SET status = ?, locked_at = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).run(newStatus, jobId);
}

export function getRecentJobs(limit = 20): AgentJob[] {
  return getDb().prepare(
    `SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as AgentJob[];
}

export function getJobsByProject(projectId: string): AgentJob[] {
  return getDb().prepare(
    `SELECT * FROM agent_jobs WHERE project_id = ? ORDER BY created_at DESC`
  ).all(projectId) as AgentJob[];
}

export function getJobById(jobId: string): AgentJob | null {
  return (getDb().prepare('SELECT * FROM agent_jobs WHERE id = ?').get(jobId) as AgentJob) || null;
}

export function getJobStats(): { pending: number; running: number; completed: number; failed: number } {
  const db = getDb();
  const row = db.prepare(
    `SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM agent_jobs`
  ).get() as Record<string, number>;
  return {
    pending: row.pending || 0,
    running: row.running || 0,
    completed: row.completed || 0,
    failed: row.failed || 0,
  };
}

export function logAgent(jobId: string, level: 'info' | 'warn' | 'error', message: string): void {
  getDb().prepare(
    `INSERT INTO agent_log (job_id, level, message) VALUES (?, ?, ?)`
  ).run(jobId, level, message);
}

export function getJobLogs(jobId: string): AgentLogEntry[] {
  return getDb().prepare(
    `SELECT * FROM agent_log WHERE job_id = ? ORDER BY created_at ASC`
  ).all(jobId) as AgentLogEntry[];
}

export function retryJob(jobId: string): void {
  getDb().prepare(
    `UPDATE agent_jobs SET status = 'pending', locked_at = NULL, attempt = 0, updated_at = datetime('now')
     WHERE id = ? AND status = 'failed'`
  ).run(jobId);
}

export function isEmailProcessed(uid: string): boolean {
  const row = getDb().prepare('SELECT uid FROM email_tracking WHERE uid = ?').get(uid);
  return !!row;
}

export function trackEmail(uid: string, messageId: string | null, subject: string, from: string, jobId: string): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO email_tracking (uid, message_id, subject, from_address, job_id) VALUES (?, ?, ?, ?, ?)`
  ).run(uid, messageId, subject, from, jobId);
}
