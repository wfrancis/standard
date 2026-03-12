import getOpenAI, { callWithRetry } from "@/lib/openai";
import {
  SPEC_EXTRACT_SYSTEM_PROMPT,
  SPEC_EXTRACT_USER_PROMPT,
} from "@/lib/prompts/spec-extract";
import { SpecExtractionSchema, type SpecExtraction } from "@/lib/schemas/spec";

/**
 * Extract flooring specification data from text.
 * Core logic extracted from the /api/specs route handler.
 */
export async function extractSpecFromText(text: string): Promise<SpecExtraction> {
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
  if (keys.length === 1 && typeof parsed[keys[0]] === "object" && parsed[keys[0]]?.products) {
    parsed = parsed[keys[0]];
  }

  return SpecExtractionSchema.parse(parsed);
}
