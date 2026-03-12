import fs from 'fs';
import { extractSpecFromText } from '@/lib/extract-spec';
import { saveSpec } from '@/lib/db';
import { logAgent } from './queue';
import type { AgentJob, SpecReadPayload } from './types';

/**
 * Process a spec_read job: read PDF, extract spec data, save results.
 */
export async function processSpecRead(job: AgentJob): Promise<void> {
  const payload = JSON.parse(job.payload_json) as SpecReadPayload;

  logAgent(job.id, 'info', `Reading specs: ${payload.filename}`);

  // Read PDF and extract text
  const buffer = fs.readFileSync(payload.pdf_path);
  const pdfParse = (await import('pdf-parse')).default;
  const pdfData = await pdfParse(buffer);

  logAgent(job.id, 'info', `Extracted ${pdfData.text.length} chars of text`);

  // Extract spec data
  const extraction = await extractSpecFromText(pdfData.text);

  // Save to DB
  const specId = saveSpec(payload.project_id, extraction as unknown as Record<string, unknown>);

  const productCount = extraction.products?.length || 0;
  logAgent(job.id, 'info', `Extracted ${productCount} products, saved as ${specId}`);
}
