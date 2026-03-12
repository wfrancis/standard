import { NextRequest, NextResponse } from "next/server";
import { updateProject, deleteProject } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { bid_summary_json, name, gc_name, gc_estimator, gc_email, bid_date, bid_time, status } = body;

    const fields: Record<string, unknown> = {};
    if (bid_summary_json !== undefined) fields.bid_summary_json = typeof bid_summary_json === "string" ? bid_summary_json : JSON.stringify(bid_summary_json);
    if (name !== undefined) fields.name = name;
    if (gc_name !== undefined) fields.gc_name = gc_name;
    if (gc_estimator !== undefined) fields.gc_estimator = gc_estimator;
    if (gc_email !== undefined) fields.gc_email = gc_email;
    if (bid_date !== undefined) fields.bid_date = bid_date;
    if (bid_time !== undefined) fields.bid_time = bid_time;
    if (status !== undefined) fields.status = status;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = updateProject(params.id, fields);
    if (!updated) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: updated });
  } catch (err) {
    console.error("PATCH /api/projects/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = deleteProject(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
