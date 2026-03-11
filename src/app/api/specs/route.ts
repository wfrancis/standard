import { NextRequest, NextResponse } from "next/server";
import getOpenAI, { callWithRetry } from "@/lib/openai";
import {
  SPEC_EXTRACT_SYSTEM_PROMPT,
  SPEC_EXTRACT_USER_PROMPT,
} from "@/lib/prompts/spec-extract";
import { SpecExtractionSchema } from "@/lib/schemas/spec";

async function extractFromText(text: string) {
  const truncatedText = text.slice(0, 48000);

  const response = await callWithRetry(() =>
    getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SPEC_EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: SPEC_EXTRACT_USER_PROMPT(truncatedText) },
      ],
      max_tokens: 4000,
    })
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from AI model");
  }

  let parsed = JSON.parse(raw);
  const keys = Object.keys(parsed);
  if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && parsed[keys[0]]?.products) {
    parsed = parsed[keys[0]];
  }
  return SpecExtractionSchema.parse(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let fullText: string;

    if (contentType.includes("application/json")) {
      // Text input mode
      const body = await request.json();
      const { content } = body;
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

    const extraction = await extractFromText(fullText);
    return NextResponse.json({ extraction });
  } catch (err) {
    console.error("Spec extraction error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract specifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
