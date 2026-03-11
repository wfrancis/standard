import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const projects = getDb()
      .prepare(
        "SELECT id, name, gc_name, gc_estimator, gc_email, bid_date, bid_time, status, created_at, updated_at FROM projects WHERE status = ? ORDER BY CASE WHEN bid_date IS NULL THEN 1 ELSE 0 END, bid_date ASC"
      )
      .all(status);

    return NextResponse.json({ projects });
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
