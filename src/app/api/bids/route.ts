import { NextRequest, NextResponse } from "next/server";
import { parseBidInvite } from "@/lib/parse-bid";
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

    const summary = await parseBidInvite(content);

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
