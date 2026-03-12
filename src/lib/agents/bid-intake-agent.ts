import { parseBidInvite } from '@/lib/parse-bid';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { enqueueJob, logAgent, isEmailProcessed, trackEmail } from './queue';
import { fetchUnreadBidEmails, saveAttachments } from './email-client';
import type { AgentJob, BidIntakePayload } from './types';

/**
 * Poll email inbox for new bid invites. Creates bid_intake jobs for each new email.
 */
export async function pollEmailInbox(): Promise<number> {
  // Skip if IMAP not configured
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
    return 0;
  }

  let count = 0;
  try {
    const emails = await fetchUnreadBidEmails();

    for (const email of emails) {
      if (isEmailProcessed(email.uid)) continue;

      // Save attachments to temp location before project is created
      const tempId = `pending-${email.uid}`;
      const savedFiles = saveAttachments(tempId, email.attachments);

      const payload: BidIntakePayload = {
        email_uid: email.uid,
        subject: email.subject,
        from: email.from,
        body: email.body,
        attachments: savedFiles,
      };

      const jobId = enqueueJob('bid_intake', payload as unknown as Record<string, unknown>);
      trackEmail(email.uid, email.messageId, email.subject, email.from, jobId);
      count++;
    }
  } catch (err) {
    console.error('[agent] Email poll failed:', err);
  }

  return count;
}

/**
 * Process a bid_intake job: parse email body, create project, enqueue downstream jobs.
 */
export async function processBidIntake(job: AgentJob): Promise<void> {
  const payload = JSON.parse(job.payload_json) as BidIntakePayload;

  logAgent(job.id, 'info', `Processing bid from ${payload.from}: ${payload.subject}`);

  // Parse bid invite text
  const summary = await parseBidInvite(payload.body);
  logAgent(job.id, 'info', `Parsed: ${summary.projectName}`);

  // Create project
  const projectId = uuidv4();
  getDb().prepare(
    `INSERT INTO projects (id, name, gc_name, gc_estimator, gc_email, bid_date, bid_time, status, bid_summary_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    projectId,
    summary.projectName,
    summary.gcName,
    summary.gcEstimator || null,
    summary.gcEmail || null,
    summary.bidDate,
    summary.bidTime || null,
    JSON.stringify(summary)
  );
  logAgent(job.id, 'info', `Created project ${projectId}`);

  // Update job with project association
  getDb().prepare('UPDATE agent_jobs SET project_id = ? WHERE id = ?').run(projectId, job.id);

  // Move attachments from temp to project directory
  const fs = await import('fs');
  const path = await import('path');
  const baseDir = process.env.NODE_ENV === 'production'
    ? '/data/attachments'
    : path.join(process.cwd(), 'data', 'attachments');

  const tempDir = path.join(baseDir, `pending-${payload.email_uid}`);
  const projectDir = path.join(baseDir, projectId);

  if (fs.existsSync(tempDir)) {
    fs.renameSync(tempDir, projectDir);
    // Update file paths in payload
    for (const att of payload.attachments) {
      att.path = att.path.replace(`pending-${payload.email_uid}`, projectId);
    }
  }

  // Classify attachments by filename heuristic and enqueue downstream jobs
  for (const att of payload.attachments) {
    const lower = att.filename.toLowerCase();
    const isSpec = lower.includes('spec') || lower.includes('section') || lower.includes('div');
    const isDrawing = lower.includes('drawing') || lower.includes('plan') || lower.includes('sheet') || lower.includes('dwg');

    if (isSpec) {
      enqueueJob('spec_read', { project_id: projectId, pdf_path: att.path, filename: att.filename }, projectId);
      logAgent(job.id, 'info', `Enqueued spec_read for ${att.filename}`);
    } else if (isDrawing) {
      enqueueJob('drawing_sort', { project_id: projectId, pdf_path: att.path, filename: att.filename }, projectId);
      logAgent(job.id, 'info', `Enqueued drawing_sort for ${att.filename}`);
    } else {
      // Default: try both — drawings are more common
      enqueueJob('drawing_sort', { project_id: projectId, pdf_path: att.path, filename: att.filename }, projectId);
      logAgent(job.id, 'info', `Enqueued drawing_sort (default) for ${att.filename}`);
    }
  }

  logAgent(job.id, 'info', `Bid intake complete. Project: ${summary.projectName}`);
}
