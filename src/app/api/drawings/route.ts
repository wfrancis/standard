import { NextRequest, NextResponse } from "next/server";
import { classifyDrawingPage } from "@/lib/classify-drawing-page";
import { saveDrawings } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

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
      const result = await classifyDrawingPage(pageTexts[i], i + 1);
      classifications.push(result);
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

    // Persist to DB if projectId provided
    if (projectId) {
      saveDrawings(projectId, classifications);
    }

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
