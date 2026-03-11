import { NextRequest, NextResponse } from "next/server";
import getOpenAI, { callWithRetry } from "@/lib/openai";
import {
  BID_INTAKE_SYSTEM_PROMPT,
  BID_INTAKE_USER_PROMPT,
} from "@/lib/prompts/bid-intake";
import { BidSummarySchema } from "@/lib/schemas/bid";
import getDb from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Missing or empty 'content' field" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "No response from AI model" },
        { status: 502 }
      );
    }

    let parsed = JSON.parse(raw);
    // GPT sometimes wraps in a key like { "bidSummary": {...} } — unwrap if needed
    const keys = Object.keys(parsed);
    if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && parsed[keys[0]]?.projectName) {
      parsed = parsed[keys[0]];
    }
    const summary = BidSummarySchema.parse(parsed);

    // Create project in database
    const projectId = uuidv4();
    getDb().prepare(
      `INSERT INTO projects (id, name, gc_name, gc_estimator, gc_email, bid_date, bid_time, status, bid_summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).run(
      projectId,
      summary.projectName,
      summary.gcName,
      summary.gcEstimator || null,
      summary.gcEmail || null,
      summary.bidDate,
      summary.bidTime || null,
      JSON.stringify(summary)
    );

    return NextResponse.json({ projectId, summary });
  } catch (err) {
    console.error("Bid intake error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to process bid invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
