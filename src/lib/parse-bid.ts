import getOpenAI, { callWithRetry } from "@/lib/openai";
import {
  BID_INTAKE_SYSTEM_PROMPT,
  BID_INTAKE_USER_PROMPT,
} from "@/lib/prompts/bid-intake";
import { BidSummarySchema, type BidSummary } from "@/lib/schemas/bid";

/**
 * Parse a bid invite text into a structured BidSummary.
 * Core logic extracted from the /api/bids route handler.
 */
export async function parseBidInvite(content: string): Promise<BidSummary> {
  const response = await callWithRetry(() =>
    getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BID_INTAKE_SYSTEM_PROMPT },
        { role: "user", content: BID_INTAKE_USER_PROMPT(content) },
      ],
      max_tokens: 2000,
    })
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from AI model");
  }

  let parsed = JSON.parse(raw);
  // GPT sometimes wraps in a key like { "bidSummary": {...} } — unwrap if needed
  const keys = Object.keys(parsed);
  if (keys.length === 1 && typeof parsed[keys[0]] === "object" && parsed[keys[0]]?.projectName) {
    parsed = parsed[keys[0]];
  }

  return BidSummarySchema.parse(parsed);
}
