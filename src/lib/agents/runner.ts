import { dequeueJob, completeJob, failJob } from './queue';
import { pollEmailInbox, processBidIntake } from './bid-intake-agent';
import { processDrawingSort } from './drawing-sorter-agent';
import { processSpecRead } from './spec-reader-agent';
import type { AgentJob } from './types';

const POLL_INTERVAL = parseInt(process.env.AGENT_POLL_INTERVAL || '60000');

async function processJob(job: AgentJob): Promise<void> {
  switch (job.type) {
    case 'bid_intake':
      await processBidIntake(job);
      break;
    case 'drawing_sort':
      await processDrawingSort(job);
      break;
    case 'spec_read':
      await processSpecRead(job);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function tick(): Promise<void> {
  try {
    // Poll for new emails first
    const newEmails = await pollEmailInbox();
    if (newEmails > 0) {
      console.log(`[agent] Discovered ${newEmails} new email(s)`);
    }

    // Process queued jobs
    let job = dequeueJob();
    while (job) {
      console.log(`[agent] Processing ${job.type} job ${job.id} (attempt ${job.attempt})`);
      try {
        await processJob(job);
        completeJob(job.id, { success: true });
        console.log(`[agent] Completed ${job.type} job ${job.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[agent] Failed ${job.type} job ${job.id}: ${msg}`);
        failJob(job.id, msg);
      }
      job = dequeueJob();
    }
  } catch (err) {
    console.error('[agent] Tick error:', err);
  }
}

export function startAgentLoop(): void {
  console.log(`[agent] Starting agent loop (interval: ${POLL_INTERVAL}ms)`);

  async function loop() {
    await tick();
    setTimeout(loop, POLL_INTERVAL);
  }

  // Start after a short delay to let the server boot
  setTimeout(loop, 5000);
}
