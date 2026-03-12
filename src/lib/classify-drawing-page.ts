import getOpenAI, { callWithRetry } from '@/lib/openai';
import { DRAWING_CLASSIFY_SYSTEM_PROMPT } from '@/lib/prompts/drawing-classify';
import { DrawingClassificationSchema, type DrawingClassification } from '@/lib/schemas/drawing';

/**
 * Classify a single drawing page using GPT.
 * Returns a fallback entry if the page text is too short or classification fails.
 */
export async function classifyDrawingPage(
  pageText: string,
  pageNumber: number
): Promise<DrawingClassification> {
  // Skip very short pages (likely blank or just headers)
  if (pageText.length < 20) {
    return {
      pageNumber,
      sheetId: `P${pageNumber}`,
      discipline: 'other',
      relevanceToFlooring: 'none',
    };
  }

  try {
    const response = await callWithRetry(() =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: DRAWING_CLASSIFY_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Classify this construction drawing sheet (page ${pageNumber}). Based on the text content extracted from this page, identify the sheet number, title, discipline, and relevance to flooring scope.\n\nExtracted text:\n---\n${pageText.slice(0, 3000)}\n---\n\nReturn JSON with fields: pageNumber (number), sheetId (string), sheetTitle (string or null), discipline (one of: architectural_floor_plan, enlarged_plan, finish_schedule, detail_sheet, reflected_ceiling_plan, demolition_plan, elevation, section, cover_sheet, mechanical, electrical, plumbing, structural, civil, interior_design, other), relevanceToFlooring (one of: high, medium, low, none), flooringNotes (string or null), detailTypes (array of strings or null), phase (string or null).`,
          },
        ],
        max_tokens: 500,
      })
    );

    const raw = response.choices[0]?.message?.content;
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.pageNumber = pageNumber;
      return DrawingClassificationSchema.parse(parsed);
    }
  } catch (err) {
    console.error(`Failed to classify page ${pageNumber}:`, err);
  }

  return {
    pageNumber,
    sheetId: `P${pageNumber}`,
    discipline: 'other',
    relevanceToFlooring: 'none',
    flooringNotes: 'Classification failed for this page',
  };
}
