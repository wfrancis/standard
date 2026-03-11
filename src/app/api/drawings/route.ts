import { NextRequest, NextResponse } from "next/server";
import getOpenAI, { callWithRetry } from "@/lib/openai";
import { DRAWING_CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts/drawing-classify";
import { DrawingClassificationSchema } from "@/lib/schemas/drawing";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Read the PDF file as a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF using pdf-parse
    // Using dynamic import because pdf-parse has CJS issues with some bundlers
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text;

    // Split text into rough page chunks
    // pdf-parse separates pages with form feeds or we estimate by content length
    const pageTexts = fullText
      .split(/\f/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);

    const totalPages = pageTexts.length || pdfData.numpages || 1;

    // For MVP: send each page's text to GPT for classification
    // Process in batches to avoid rate limits
    const classifications = [];

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i];

      // Skip very short pages (likely blank or just headers)
      if (pageText.length < 20) {
        classifications.push({
          pageNumber: i + 1,
          sheetId: `P${i + 1}`,
          sheetTitle: null,
          discipline: "other" as const,
          relevanceToFlooring: "none" as const,
          flooringNotes: null,
        });
        continue;
      }

      try {
        const response = await callWithRetry(() =>
          getOpenAI().chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: DRAWING_CLASSIFY_SYSTEM_PROMPT },
              {
                role: "user",
                content: `Classify this construction drawing sheet (page ${i + 1}). Based on the text content extracted from this page, identify the sheet number, title, discipline, and relevance to flooring scope.\n\nExtracted text:\n---\n${pageText.slice(0, 3000)}\n---\n\nReturn JSON with fields: pageNumber (number), sheetId (string), sheetTitle (string or null), discipline (one of: architectural_floor_plan, enlarged_plan, finish_schedule, detail_sheet, reflected_ceiling_plan, demolition_plan, elevation, section, cover_sheet, mechanical, electrical, plumbing, structural, civil, interior_design, other), relevanceToFlooring (one of: high, medium, low, none), flooringNotes (string or null), detailTypes (array of strings or null), phase (string or null).`,
              },
            ],
            max_tokens: 500,
          })
        );

        const raw = response.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.pageNumber = i + 1; // Ensure correct page number
          const validated = DrawingClassificationSchema.parse(parsed);
          classifications.push(validated);
        }
      } catch (pageErr) {
        // If individual page fails, add a fallback entry
        console.error(`Failed to classify page ${i + 1}:`, pageErr);
        classifications.push({
          pageNumber: i + 1,
          sheetId: `P${i + 1}`,
          sheetTitle: null,
          discipline: "other" as const,
          relevanceToFlooring: "none" as const,
          flooringNotes: "Classification failed for this page",
        });
      }
    }

    // Build summary
    const summary = {
      highRelevance: classifications.filter(
        (c) => c.relevanceToFlooring === "high"
      ).length,
      mediumRelevance: classifications.filter(
        (c) => c.relevanceToFlooring === "medium"
      ).length,
      lowRelevance: classifications.filter(
        (c) => c.relevanceToFlooring === "low"
      ).length,
      noRelevance: classifications.filter(
        (c) => c.relevanceToFlooring === "none"
      ).length,
    };

    return NextResponse.json({
      totalPages,
      classifications,
      summary,
    });
  } catch (err) {
    console.error("Drawing classification error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to classify drawings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
