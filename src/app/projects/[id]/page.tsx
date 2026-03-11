import getDb from "@/lib/db";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";

interface ProjectRow {
  id: string;
  name: string;
  gc_name: string | null;
  gc_estimator: string | null;
  gc_email: string | null;
  bid_date: string | null;
  bid_time: string | null;
  status: string;
  bid_summary_json: string | null;
  created_at: string;
  updated_at: string;
}

interface DrawingRow {
  id: string;
  page_number: number;
  sheet_id: string;
  sheet_title: string | null;
  discipline: string;
  relevance: string;
  flooring_notes: string | null;
  detail_types: string | null;
  phase: string | null;
}

interface SpecRow {
  id: string;
  extraction_json: string | null;
  source_pages: string | null;
  created_at: string;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(params.id) as ProjectRow | undefined;

  if (!project) {
    notFound();
  }

  const drawings = getDb()
    .prepare("SELECT * FROM drawings WHERE project_id = ? ORDER BY page_number")
    .all(project.id) as DrawingRow[];

  const specs = getDb()
    .prepare("SELECT * FROM specs WHERE project_id = ? ORDER BY created_at DESC")
    .all(project.id) as SpecRow[];

  const bidSummary = project.bid_summary_json
    ? JSON.parse(project.bid_summary_json)
    : null;

  const specExtractions = specs
    .filter((s) => s.extraction_json)
    .map((s) => JSON.parse(s.extraction_json!));

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        name: project.name,
        gcName: project.gc_name,
        gcEstimator: project.gc_estimator,
        gcEmail: project.gc_email,
        bidDate: project.bid_date,
        bidTime: project.bid_time,
        status: project.status,
        createdAt: project.created_at,
      }}
      bidSummary={bidSummary}
      drawings={drawings.map((d) => ({
        pageNumber: d.page_number,
        sheetId: d.sheet_id,
        sheetTitle: d.sheet_title,
        discipline: d.discipline,
        relevanceToFlooring: d.relevance,
        flooringNotes: d.flooring_notes,
        detailTypes: d.detail_types ? JSON.parse(d.detail_types) : [],
        phase: d.phase,
      }))}
      specExtractions={specExtractions}
    />
  );
}
