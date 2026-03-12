import { NextRequest, NextResponse } from "next/server";
import { extractSpecFromText } from "@/lib/extract-spec";
import { saveSpec } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let fullText: string;
    let projectId: string | null = null;

    if (contentType.includes("application/json")) {
      // Text input mode
      const body = await request.json();
      const { content } = body;
      projectId = body.projectId || null;
      if (!content || typeof content !== "string" || !content.trim()) {
        return NextResponse.json(
          { error: "Missing or empty 'content' field" },
          { status: 400 }
        );
      }
      fullText = content;
    } else {
      // File upload mode
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      projectId = formData.get("projectId") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      fullText = pdfData.text;

      if (!fullText || fullText.trim().length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from PDF. The file may be image-based." },
          { status: 422 }
        );
      }
    }

    const extraction = await extractSpecFromText(fullText);

    // Persist to DB if projectId provided
    if (projectId) {
      saveSpec(projectId, extraction as unknown as Record<string, unknown>);
    }

    return NextResponse.json({ extraction });
  } catch (err) {
    console.error("Spec extraction error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract specifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
