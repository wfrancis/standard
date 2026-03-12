import fs from 'fs';
import pLimit from 'p-limit';
import { classifyDrawingPage } from '@/lib/classify-drawing-page';
import { saveDrawings } from '@/lib/db';
import { logAgent } from './queue';
import type { AgentJob, DrawingSortPayload } from './types';

/**
 * Process a drawing_sort job: read PDF, classify each page, save results.
 */
export async function processDrawingSort(job: AgentJob): Promise<void> {
  const payload = JSON.parse(job.payload_json) as DrawingSortPayload;

  logAgent(job.id, 'info', `Classifying drawings: ${payload.filename}`);

  // Read PDF from disk
  const buffer = fs.readFileSync(payload.pdf_path);

  // Extract text
  const pdfParse = (await import('pdf-parse')).default;
  const pdfData = await pdfParse(buffer);

  const pageTexts = pdfData.text
    .split(/\f/)
    .map((t: string) => t.trim())
    .filter((t: string) => t.length > 0);

  logAgent(job.id, 'info', `Found ${pageTexts.length} pages`);

  // Classify pages with limited concurrency
  const limit = pLimit(3);
  const classifications = await Promise.all(
    pageTexts.map((text: string, i: number) =>
      limit(() => classifyDrawingPage(text, i + 1))
    )
  );

  // Save to DB
  saveDrawings(payload.project_id, classifications);

  const highCount = classifications.filter(c => c.relevanceToFlooring === 'high').length;
  logAgent(job.id, 'info', `Classified ${classifications.length} pages (${highCount} high relevance)`);
}
