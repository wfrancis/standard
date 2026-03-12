"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import FileUpload from "@/components/FileUpload";
import type { BidSummary } from "@/lib/schemas/bid";
import type { SpecExtraction } from "@/lib/schemas/spec";
import type { DrawingClassification } from "@/lib/schemas/drawing";
import { crossReferenceScope, buildSFReconciliation, type SFReconciliationItem, type CrossReferenceResult } from "@/lib/scope-matcher";
import { formatBidSummaryText } from "@/lib/format-bid-summary";

interface ProjectInfo {
  id: string;
  name: string;
  gcName: string | null;
  gcEstimator: string | null;
  gcEmail: string | null;
  bidDate: string | null;
  bidTime: string | null;
  status: string;
  createdAt: string;
}

interface DrawingItem {
  pageNumber: number;
  sheetId: string;
  sheetTitle: string | null;
  discipline: string;
  relevanceToFlooring: string;
  flooringNotes: string | null;
  detailTypes: string[];
  phase: string | null;
}

const relevanceColors: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-600",
  none: "bg-gray-50 text-gray-400",
};

const tabs = ["Summary", "Drawings", "Specs", "Export", "Agents"] as const;
type Tab = (typeof tabs)[number];

function daysUntilBid(bidDate: string | null): string | null {
  if (!bidDate) return null;
  const now = new Date();
  const due = new Date(bidDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Past due";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `${diffDays} days`;
}

function formatRecommendation(rec: string): string {
  return rec.replace(/_/g, " ");
}

// Inline editable text field
function EditableField({
  value,
  onSave,
  label,
  multiline = false,
}: {
  value: string;
  onSave: (val: string) => void;
  label?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border border-blue-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
            autoFocus
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border border-blue-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSave(draft);
                setEditing(false);
              }
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
          />
        )}
        <button
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Save
        </button>
        <button
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <span
      className="group cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 transition-colors"
      onClick={() => setEditing(true)}
      title={label ? `Click to edit ${label}` : "Click to edit"}
    >
      {value}
      <span className="invisible group-hover:visible text-blue-400 ml-1 text-xs">✎</span>
    </span>
  );
}

export default function ProjectDetailClient({
  project,
  bidSummary: initialBidSummary,
  drawings: initialDrawings,
  specExtractions: initialSpecs,
}: {
  project: ProjectInfo;
  bidSummary: BidSummary | null;
  drawings: DrawingItem[];
  specExtractions: SpecExtraction[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [bidSummary, setBidSummary] = useState<BidSummary | null>(initialBidSummary);
  const [drawings, setDrawings] = useState<DrawingItem[]>(initialDrawings);
  const [specExtractions, setSpecExtractions] = useState<SpecExtraction[]>(initialSpecs);
  const [drawingFilter, setDrawingFilter] = useState<"all" | "relevant">("relevant");
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [drawingProgress, setDrawingProgress] = useState(0);
  const [specLoading, setSpecLoading] = useState(false);
  const [specText, setSpecText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addendaStatus, setAddendaStatus] = useState<Record<number, "reviewed" | "pending">>({});
  const [agentJobs, setAgentJobs] = useState<Array<{ id: string; type: string; status: string; created_at: string; completed_at: string | null }>>([]);
  const [agentRerunning, setAgentRerunning] = useState<string | null>(null);

  // Fetch agent jobs for this project
  useEffect(() => {
    if (activeTab !== "Agents") return;
    async function fetchJobs() {
      try {
        const res = await fetch(`/api/agents/status`);
        if (res.ok) {
          const data = await res.json();
          setAgentJobs((data.recent || []).filter((j: { project_id: string | null }) => j.project_id === project.id));
        }
      } catch { /* non-critical */ }
    }
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [activeTab, project.id]);

  // Drawing stats
  const relevantCount = drawings.filter(
    (d) => d.relevanceToFlooring === "high" || d.relevanceToFlooring === "medium"
  ).length;

  const filteredDrawings =
    drawingFilter === "all"
      ? drawings
      : drawings.filter(
          (d) => d.relevanceToFlooring === "high" || d.relevanceToFlooring === "medium"
        );

  // Scope cross-reference
  const { scopeMatches, specGaps } = useMemo<CrossReferenceResult>(() => {
    if (!bidSummary || specExtractions.length === 0) return { scopeMatches: [], specGaps: [] };
    return crossReferenceScope(bidSummary, specExtractions);
  }, [bidSummary, specExtractions]);

  // SF Reconciliation
  const sfReconciliation = useMemo<SFReconciliationItem[]>(() => {
    if (!bidSummary || bidSummary.scope.length === 0 || drawings.length === 0) return [];
    return buildSFReconciliation(bidSummary, drawings);
  }, [bidSummary, drawings]);

  // Missing addendum warnings
  const missingAddenda = useMemo(() => {
    if (!bidSummary) return [];
    const allText = [...bidSummary.keyNotes, ...bidSummary.risks].join(" ");
    const refs = allText.match(/addend(?:um|a)\s*#?(\d+)/gi) || [];
    const referenced = refs.map((r) => {
      const m = r.match(/(\d+)/);
      return m ? m[1] : null;
    }).filter(Boolean) as string[];
    const listed = (bidSummary.addenda || []).join(" ");
    return Array.from(new Set(referenced)).filter((num) => !listed.includes(num));
  }, [bidSummary]);

  // Debounced persist for bid summary edits
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistBidSummary = useCallback(
    (updated: BidSummary) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bid_summary_json: updated }),
        }).catch(() => {
          /* silently fail — edits are still in local state */
        });
      }, 500);
    },
    [project.id]
  );

  // Inline edit helper for bid summary fields
  function updateBidField<K extends keyof BidSummary>(key: K, value: BidSummary[K]) {
    if (!bidSummary) return;
    const updated = { ...bidSummary, [key]: value };
    setBidSummary(updated);
    persistBidSummary(updated);
  }

  // Upload drawings
  async function handleDrawingUpload(file: File) {
    setDrawingLoading(true);
    setError(null);
    setDrawingProgress(0);

    const progressInterval = setInterval(() => {
      setDrawingProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 12));
    }, 500);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", project.id);

      const res = await fetch("/api/drawings", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to classify drawings");
      }

      const data = await res.json();
      const classified: DrawingItem[] = (data.classifications ?? []).map(
        (c: DrawingClassification) => ({
          pageNumber: c.pageNumber,
          sheetId: c.sheetId,
          sheetTitle: c.sheetTitle || null,
          discipline: c.discipline,
          relevanceToFlooring: c.relevanceToFlooring,
          flooringNotes: c.flooringNotes || null,
          detailTypes: c.detailTypes || [],
          phase: c.phase || null,
        })
      );
      setDrawings(classified);
      setDrawingProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearInterval(progressInterval);
      setDrawingLoading(false);
    }
  }

  // Upload/paste specs
  async function handleSpecText() {
    if (!specText.trim()) return;
    setSpecLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: specText, projectId: project.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to extract specs");
      }
      const data = await res.json();
      setSpecExtractions((prev) => [...prev, data.extraction]);
      setSpecText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSpecLoading(false);
    }
  }

  async function handleSpecFile(file: File) {
    setSpecLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", project.id);

      const res = await fetch("/api/specs", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to extract specs");
      }
      const data = await res.json();
      setSpecExtractions((prev) => [...prev, data.extraction]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSpecLoading(false);
    }
  }

  // Copy summary
  async function handleCopy() {
    if (!bidSummary) return;
    await navigator.clipboard.writeText(formatBidSummaryText(bidSummary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Pipeline stages
  const stages = [
    { label: "Bid", done: !!bidSummary },
    { label: "Drawings", done: drawings.length > 0 },
    { label: "Specs", done: specExtractions.length > 0 },
  ];

  const bidDaysLabel = daysUntilBid(project.bidDate);

  return (
    <div className="p-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 no-print">
        <a href="/" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-3">
            {bidDaysLabel && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                bidDaysLabel === "Past due" ? "bg-gray-200 text-gray-600" :
                bidDaysLabel === "Due today" || bidDaysLabel === "Due tomorrow" ? "bg-red-100 text-red-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {bidDaysLabel}
              </span>
            )}
            {bidSummary && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold border ${
                  bidSummary.recommendation === "BID"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : bidSummary.recommendation === "PASS"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : "bg-yellow-100 text-yellow-800 border-yellow-200"
                }`}
              >
                {formatRecommendation(bidSummary.recommendation)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {project.gcName && <span>GC: {project.gcName}</span>}
          {project.bidDate && (
            <span>
              Bid: {project.bidDate}
              {project.bidTime ? ` at ${project.bidTime}` : ""}
            </span>
          )}
          {bidSummary?.projectLocation && (
            <span>📍 {bidSummary.projectLocation}</span>
          )}
        </div>
        {/* Pipeline stages */}
        <div className="flex items-center gap-3 mt-4">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  stage.done
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {stage.done ? "\u2713" : "\u2014"}
              </span>
              <span className={`text-xs font-medium ${stage.done ? "text-green-700" : "text-gray-400"}`}>
                {stage.label}
              </span>
              {i < stages.length - 1 && (
                <span className="text-gray-300 mx-1">&rarr;</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6 no-print">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              {tab === "Drawings" && drawings.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({relevantCount} of {drawings.length})
                </span>
              )}
              {tab === "Specs" && specExtractions.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({specExtractions.reduce((acc, s) => acc + s.products.length, 0)} products)
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ========== SUMMARY TAB ========== */}
      {activeTab === "Summary" && (
        <div className="space-y-6">
          {bidSummary ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Bid Summary</h2>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {bidSummary.projectLocation && (
                    <div>
                      <span className="text-gray-500">Location:</span>{" "}
                      <EditableField
                        value={bidSummary.projectLocation}
                        onSave={(v) => updateBidField("projectLocation", v)}
                        label="location"
                      />
                    </div>
                  )}
                  {!bidSummary.projectLocation && (
                    <div>
                      <span className="text-gray-500">Location:</span>{" "}
                      <button
                        onClick={() => updateBidField("projectLocation", "Enter location")}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        + Add location
                      </button>
                    </div>
                  )}
                  {bidSummary.owner && (
                    <div>
                      <span className="text-gray-500">Owner:</span>{" "}
                      <EditableField
                        value={bidSummary.owner}
                        onSave={(v) => updateBidField("owner", v)}
                        label="owner"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">GC:</span>{" "}
                    <EditableField
                      value={bidSummary.gcName}
                      onSave={(v) => updateBidField("gcName", v)}
                      label="GC name"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500">Bid Date:</span>{" "}
                    <EditableField
                      value={`${bidSummary.bidDate}${bidSummary.bidTime ? ` at ${bidSummary.bidTime}` : ""}`}
                      onSave={(v) => {
                        const parts = v.split(" at ");
                        updateBidField("bidDate", parts[0]);
                        if (parts[1]) updateBidField("bidTime", parts[1]);
                      }}
                      label="bid date"
                    />{" "}
                    <ConfidenceBadge level={bidSummary.confidence.bidDate} />
                  </div>
                  {bidSummary.gcEstimator && (
                    <div>
                      <span className="text-gray-500">Estimator:</span>{" "}
                      <EditableField
                        value={bidSummary.gcEstimator}
                        onSave={(v) => updateBidField("gcEstimator", v)}
                        label="estimator"
                      />
                    </div>
                  )}
                  {bidSummary.gcEmail && (
                    <div>
                      <span className="text-gray-500">Email:</span>{" "}
                      <EditableField
                        value={bidSummary.gcEmail}
                        onSave={(v) => updateBidField("gcEmail", v)}
                        label="email"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Scope */}
              {bidSummary.scope.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Scope
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">SF</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Product</th>
                        <th className="text-left py-2 font-medium text-gray-500">Manufacturer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidSummary.scope.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-4">
                            <EditableField
                              value={s.flooringType}
                              onSave={(v) => {
                                const newScope = [...bidSummary.scope];
                                newScope[i] = { ...newScope[i], flooringType: v };
                                updateBidField("scope", newScope);
                              }}
                              label="flooring type"
                            />
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            <EditableField
                              value={s.approxSF || "\u2014"}
                              onSave={(v) => {
                                const newScope = [...bidSummary.scope];
                                newScope[i] = { ...newScope[i], approxSF: v === "\u2014" ? null : v };
                                updateBidField("scope", newScope);
                              }}
                              label="square footage"
                            />
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            <EditableField
                              value={s.product || "\u2014"}
                              onSave={(v) => {
                                const newScope = [...bidSummary.scope];
                                newScope[i] = { ...newScope[i], product: v === "\u2014" ? null : v };
                                updateBidField("scope", newScope);
                              }}
                              label="product"
                            />
                          </td>
                          <td className="py-2 text-gray-600">
                            <EditableField
                              value={s.manufacturer || "\u2014"}
                              onSave={(v) => {
                                const newScope = [...bidSummary.scope];
                                newScope[i] = { ...newScope[i], manufacturer: v === "\u2014" ? null : v };
                                updateBidField("scope", newScope);
                              }}
                              label="manufacturer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Alternates */}
              {bidSummary.alternates && bidSummary.alternates.length > 0 && (
                <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
                  <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3">
                    Alternates
                  </h3>
                  <div className="space-y-2">
                    {bidSummary.alternates.map((alt, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-purple-900">
                        <span className="font-bold text-purple-600 min-w-[3rem]">
                          Alt {alt.number || i + 1}:
                        </span>
                        <EditableField
                          value={alt.description}
                          onSave={(v) => {
                            const newAlts = [...(bidSummary.alternates || [])];
                            newAlts[i] = { ...newAlts[i], description: v };
                            updateBidField("alternates", newAlts);
                          }}
                          label="alternate"
                        />
                        {alt.estimatedSF && (
                          <span className="text-purple-500 text-xs">({alt.estimatedSF})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Addenda */}
              {bidSummary.addenda && bidSummary.addenda.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                      Addenda
                      <span className="ml-2 inline-block px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-bold">
                        {bidSummary.addenda.length}
                      </span>
                    </h3>
                  </div>
                  {missingAddenda.length > 0 && (
                    <div className="mb-3 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                      {missingAddenda.map((num) => (
                        <div key={num}>Addendum {num} referenced in notes but not listed. Has it been received?</div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {bidSummary.addenda.map((addendum, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-amber-900">
                        <span>{addendum}</span>
                        <button
                          onClick={() =>
                            setAddendaStatus((prev) => ({
                              ...prev,
                              [i]: prev[i] === "reviewed" ? "pending" : "reviewed",
                            }))
                          }
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            addendaStatus[i] === "reviewed"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-200 text-amber-700"
                          }`}
                        >
                          {addendaStatus[i] === "reviewed" ? "Reviewed" : "Pending"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const newAddenda = [...(bidSummary.addenda || []), "New addendum"];
                      updateBidField("addenda", newAddenda);
                    }}
                    className="mt-3 text-xs text-amber-600 hover:text-amber-800"
                  >
                    + Add Addendum
                  </button>
                </div>
              )}

              {/* Scope Cross-Reference */}
              {scopeMatches.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Scope vs. Spec Cross-Reference
                  </h3>
                  <div className="space-y-2">
                    {scopeMatches.map((match, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${
                          match.status === "matched"
                            ? "bg-green-50 text-green-800"
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        <span className="mt-0.5 font-bold">
                          {match.status === "matched" ? "\u2713" : "\u2717"}
                        </span>
                        <span>{match.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spec Items Not in Bid Scope */}
              {specGaps.length > 0 && (
                <div className="bg-orange-50 rounded-xl border-2 border-orange-300 p-6">
                  <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-1">
                    Spec Items Not in Bid Scope
                    <span className="ml-2 inline-block px-1.5 py-0.5 bg-orange-200 text-orange-800 rounded text-xs">
                      {specGaps.length}
                    </span>
                  </h3>
                  <p className="text-xs text-orange-600 mb-4">
                    These products appear in the spec but are not referenced in the bid scope. Flag as potential change orders or confirm exclusion.
                  </p>
                  <div className="space-y-2">
                    {specGaps.map((gap, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 bg-white rounded-lg border border-orange-200">
                        <span className="font-mono text-xs text-orange-700 min-w-[5rem]">{gap.csiSection}</span>
                        <span className="text-gray-900 flex-1">{gap.productTitle}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 whitespace-nowrap">
                          {gap.impact}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SF Reconciliation */}
              {sfReconciliation.length > 0 && sfReconciliation.some((r) => r.scopeSF) && drawings.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Quantity Reconciliation
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Flooring Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Bid Scope SF</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Drawing Sheets</th>
                        <th className="text-left py-2 font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sfReconciliation.map((item, i) => (
                        <tr
                          key={i}
                          className={`border-b border-gray-50 ${
                            item.plausibility === "review" ? "bg-yellow-50" : ""
                          }`}
                        >
                          <td className="py-2 pr-4">{item.flooringType}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.scopeSF || "\u2014"}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            {item.relevantSheetCount} sheet{item.relevantSheetCount !== 1 ? "s" : ""}
                            {item.matchingSheetIds.length > 0 && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({item.matchingSheetIds.slice(0, 3).join(", ")}
                                {item.matchingSheetIds.length > 3 ? "..." : ""})
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                item.plausibility === "review"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {item.plausibility === "review" ? "REVIEW" : "OK"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Risks */}
              {bidSummary.risks.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                  <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">
                    Risks
                  </h3>
                  <ul className="space-y-1.5">
                    {bidSummary.risks.map((r, i) => (
                      <li key={i} className="text-sm text-red-800">- {r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Notes */}
              {bidSummary.keyNotes.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Key Notes
                  </h3>
                  <ul className="space-y-1.5">
                    {bidSummary.keyNotes.map((n, i) => (
                      <li key={i} className="text-sm text-gray-700">- {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>No bid summary available for this project.</p>
            </div>
          )}
        </div>
      )}

      {/* ========== DRAWINGS TAB ========== */}
      {activeTab === "Drawings" && (
        <div className="space-y-4">
          {drawings.length > 0 ? (
            <>
              {/* Filter bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDrawingFilter("relevant")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      drawingFilter === "relevant"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Flooring Sheets Only ({relevantCount})
                  </button>
                  <button
                    onClick={() => setDrawingFilter("all")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      drawingFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All Sheets ({drawings.length})
                  </button>
                </div>
                <span className="text-sm text-gray-500">
                  {relevantCount} of {drawings.length} sheets relevant to flooring
                </span>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Page</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Sheet ID</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Discipline</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Relevance</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrawings.map((d, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">{d.pageNumber}</td>
                        <td className="px-4 py-3 font-mono">{d.sheetId}</td>
                        <td className="px-4 py-3">{d.sheetTitle || "\u2014"}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {d.discipline.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              relevanceColors[d.relevanceToFlooring] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {d.relevanceToFlooring.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                          {d.flooringNotes || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : drawingLoading ? (
            <div className="py-8">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Classifying sheets...</span>
                <span>{Math.round(drawingProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${drawingProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8 text-gray-400">
                <p className="mb-4">No drawings classified yet. Upload a drawing set PDF.</p>
              </div>
              <FileUpload
                label="Upload Drawing Set"
                description="Drag and drop a drawing set PDF, or click to browse"
                onFile={handleDrawingUpload}
              />
            </div>
          )}
        </div>
      )}

      {/* ========== SPECS TAB ========== */}
      {activeTab === "Specs" && (
        <div className="space-y-6">
          {specExtractions.length > 0 && (
            <>
              {specExtractions.map((extraction, ei) => (
                <div key={ei} className="space-y-4">
                  {/* Gotchas */}
                  {extraction.gotchas.length > 0 && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                      <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-3">
                        Gotchas &mdash; Commonly Missed Cost Items
                      </h3>
                      <ul className="space-y-1.5">
                        {extraction.gotchas.map((g, i) => (
                          <li key={i} className="text-sm text-yellow-900 flex items-start gap-2">
                            <span className="font-bold mt-0.5">!</span>
                            {typeof g === "string" ? g : (g as { description: string }).description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Moisture Testing */}
                  {extraction.moistureTestingSection && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-3">
                        Moisture Testing
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {extraction.moistureTestingSection.protocol && (
                          <div>
                            <span className="text-blue-600">Protocol:</span>{" "}
                            <span className="text-blue-900">{extraction.moistureTestingSection.protocol}</span>
                          </div>
                        )}
                        {extraction.moistureTestingSection.frequency && (
                          <div>
                            <span className="text-blue-600">Frequency:</span>{" "}
                            <span className="text-blue-900">{extraction.moistureTestingSection.frequency}</span>
                          </div>
                        )}
                        {extraction.moistureTestingSection.responsibleParty && (
                          <div>
                            <span className="text-blue-600">Responsible:</span>{" "}
                            <span className="text-blue-900">{extraction.moistureTestingSection.responsibleParty}</span>
                          </div>
                        )}
                        {extraction.moistureTestingSection.acceptableLimits && (
                          <div>
                            <span className="text-blue-600">Limits:</span>{" "}
                            <span className="text-blue-900">{extraction.moistureTestingSection.acceptableLimits}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {extraction.products.map((product, pi) => (
                    <div key={pi} className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{product.sectionTitle}</h4>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{product.csiSection}</p>
                        </div>
                        {product.productName && (
                          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {product.productName}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2">
                          <span className="text-gray-500">Manufacturers:</span>{" "}
                          {product.manufacturers.map((m, j) => (
                            <span key={j}>
                              {m.name}
                              {m.isBasisOfDesign && (
                                <span className="text-xs text-blue-600 ml-1">(BOD)</span>
                              )}
                              {j < product.manufacturers.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                        {product.colors && (
                          <div><span className="text-gray-500">Colors:</span> {product.colors}</div>
                        )}
                        {product.dimensions && (
                          <div><span className="text-gray-500">Dimensions:</span> {product.dimensions}</div>
                        )}
                        {product.installMethod && (
                          <div><span className="text-gray-500">Install:</span> {product.installMethod}</div>
                        )}
                        {product.installPattern && (
                          <div><span className="text-gray-500">Pattern:</span> {product.installPattern}</div>
                        )}
                        {product.seamRequirements && (
                          <div><span className="text-gray-500">Seams:</span> {product.seamRequirements}</div>
                        )}
                        {product.flashCoveBase && (
                          <div><span className="text-gray-500">Flash Cove/Base:</span> {product.flashCoveBase}</div>
                        )}
                        {product.atticStockPercent && (
                          <div><span className="text-gray-500">Attic Stock:</span> {product.atticStockPercent}</div>
                        )}
                        {product.warranty && (
                          <div><span className="text-gray-500">Warranty:</span> {product.warranty}</div>
                        )}
                        {product.moistureLimits && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Moisture Limits:</span> {product.moistureLimits}
                          </div>
                        )}
                      </div>
                      {product.specialNotes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                          {product.specialNotes.map((n, j) => (
                            <p key={j} className="text-xs text-gray-600">- {n}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* Upload zone for specs */}
          {!specLoading ? (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700">
                {specExtractions.length > 0 ? "Add More Specs" : "Upload Spec Manual"}
              </h3>
              <textarea
                rows={6}
                value={specText}
                onChange={(e) => setSpecText(e.target.value)}
                placeholder="Paste Division 09 specification text here..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
              />
              <button
                onClick={handleSpecText}
                disabled={!specText.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Extract Specs
              </button>
              <FileUpload
                label="Or Upload Spec PDF"
                description="Drag and drop a spec book PDF"
                onFile={handleSpecFile}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                <p className="mt-3 text-sm text-gray-500">Extracting specifications...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== EXPORT TAB ========== */}
      {activeTab === "Export" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Project Summary</h3>
            <p className="text-sm text-gray-500 mb-6">
              Print a complete project summary or download as CSV for RFMS import.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Print / Save as PDF
              </button>
              {bidSummary && (
                <>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy Summary to Clipboard"}
                  </button>
                  <button
                    onClick={() => {
                      // CSV export for RFMS compatibility
                      const headers = ["Flooring Type", "Approx SF", "Product", "Manufacturer"];
                      const rows = bidSummary.scope.map(s => [
                        s.flooringType,
                        s.approxSF || "",
                        s.product || "",
                        s.manufacturer || "",
                      ]);
                      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_scope.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Print Preview */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Print Preview Includes:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className={bidSummary ? "text-green-600" : "text-gray-400"}>
                  {bidSummary ? "\u2713" : "\u2014"}
                </span>
                Bid Summary & Recommendation
              </li>
              <li className="flex items-center gap-2">
                <span className={scopeMatches.length > 0 ? "text-green-600" : "text-gray-400"}>
                  {scopeMatches.length > 0 ? "\u2713" : "\u2014"}
                </span>
                Scope vs. Spec Cross-Reference
              </li>
              <li className="flex items-center gap-2">
                <span className={drawings.length > 0 ? "text-green-600" : "text-gray-400"}>
                  {drawings.length > 0 ? "\u2713" : "\u2014"}
                </span>
                Relevant Drawings ({relevantCount} sheets)
              </li>
              <li className="flex items-center gap-2">
                <span className={specExtractions.length > 0 ? "text-green-600" : "text-gray-400"}>
                  {specExtractions.length > 0 ? "\u2713" : "\u2014"}
                </span>
                Spec Products & Gotchas
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "Agents" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Agent Activity</h3>
              <div className="flex gap-2">
                <button
                  disabled={agentRerunning === "drawing_sort"}
                  onClick={async () => {
                    setAgentRerunning("drawing_sort");
                    try {
                      await fetch("/api/agents/jobs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "drawing_sort", payload: { project_id: project.id }, projectId: project.id }),
                      });
                    } finally { setAgentRerunning(null); }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {agentRerunning === "drawing_sort" ? "Enqueuing..." : "Re-run Drawings"}
                </button>
                <button
                  disabled={agentRerunning === "spec_read"}
                  onClick={async () => {
                    setAgentRerunning("spec_read");
                    try {
                      await fetch("/api/agents/jobs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "spec_read", payload: { project_id: project.id }, projectId: project.id }),
                      });
                    } finally { setAgentRerunning(null); }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {agentRerunning === "spec_read" ? "Enqueuing..." : "Re-run Specs"}
                </button>
              </div>
            </div>

            {agentJobs.length === 0 ? (
              <p className="text-sm text-gray-500">No agent jobs for this project yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {agentJobs.map((job) => (
                  <div key={job.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {job.type === "bid_intake" ? "Bid Intake" : job.type === "drawing_sort" ? "Drawing Sort" : "Spec Read"}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{new Date(job.created_at).toLocaleString()}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      job.status === "completed" ? "bg-green-100 text-green-800" :
                      job.status === "running" ? "bg-blue-100 text-blue-800" :
                      job.status === "failed" ? "bg-red-100 text-red-800" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== PRINT-ONLY LAYOUT ========== */}
      <div className="print-only hidden">
        <div className="print-header">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {project.gcName && <span>GC: {project.gcName} | </span>}
            {project.bidDate && <span>Bid: {project.bidDate}</span>}
            {bidSummary && <span> | {formatRecommendation(bidSummary.recommendation)}</span>}
            {bidSummary?.projectLocation && <span> | {bidSummary.projectLocation}</span>}
          </div>
          <hr className="mt-3" />
        </div>

        {/* Print: Bid Summary */}
        {bidSummary && (
          <div className="mt-4">
            <h2 className="text-base font-bold mb-2">Bid Summary</h2>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              {bidSummary.projectLocation && <div>Location: {bidSummary.projectLocation}</div>}
              {bidSummary.owner && <div>Owner: {bidSummary.owner}</div>}
              <div>GC: {bidSummary.gcName}</div>
              <div>Bid: {bidSummary.bidDate}{bidSummary.bidTime ? ` at ${bidSummary.bidTime}` : ""}</div>
            </div>

            {bidSummary.scope.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-1">Scope</h3>
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Type</th>
                      <th className="text-left py-1">SF</th>
                      <th className="text-left py-1">Product</th>
                      <th className="text-left py-1">Manufacturer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bidSummary.scope.map((s, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1">{s.flooringType}</td>
                        <td className="py-1">{s.approxSF || "\u2014"}</td>
                        <td className="py-1">{s.product || "\u2014"}</td>
                        <td className="py-1">{s.manufacturer || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {bidSummary.alternates && bidSummary.alternates.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-1">Alternates</h3>
                {bidSummary.alternates.map((alt, i) => (
                  <div key={i} className="text-sm mb-1">
                    Alt {alt.number || i + 1}: {alt.description}
                    {alt.estimatedSF && ` (${alt.estimatedSF})`}
                  </div>
                ))}
              </>
            )}

            {bidSummary.addenda && bidSummary.addenda.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-1">Addenda</h3>
                {bidSummary.addenda.map((a, i) => (
                  <div key={i} className="text-sm mb-1">- {a}</div>
                ))}
              </>
            )}

            {bidSummary.risks.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-1 text-red-700">Risks</h3>
                <ul className="text-sm mb-4">
                  {bidSummary.risks.map((r, i) => (
                    <li key={i}>- {r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Print: Cross Reference */}
        {scopeMatches.length > 0 && (
          <div className="mt-4">
            <h2 className="text-base font-bold mb-2">Scope vs. Spec Cross-Reference</h2>
            {scopeMatches.map((m, i) => (
              <div key={i} className="text-sm py-0.5">
                {m.status === "matched" ? "\u2713" : "\u2717"} {m.note}
              </div>
            ))}
          </div>
        )}

        {/* Print: Spec Gaps */}
        {specGaps.length > 0 && (
          <div className="mt-4">
            <h2 className="text-base font-bold mb-2">Spec Items Not in Bid Scope</h2>
            {specGaps.map((g, i) => (
              <div key={i} className="text-sm py-0.5">
                ! {g.csiSection} {g.productTitle} — {g.impact}
              </div>
            ))}
          </div>
        )}

        {/* Print: SF Reconciliation */}
        {sfReconciliation.length > 0 && sfReconciliation.some((r) => r.scopeSF) && (
          <div className="mt-4">
            <h2 className="text-base font-bold mb-2">Quantity Reconciliation</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Type</th>
                  <th className="text-left py-1">Bid SF</th>
                  <th className="text-left py-1">Sheets</th>
                  <th className="text-left py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {sfReconciliation.map((item, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-1">{item.flooringType}</td>
                    <td className="py-1">{item.scopeSF || "\u2014"}</td>
                    <td className="py-1">{item.relevantSheetCount}</td>
                    <td className="py-1">{item.plausibility === "review" ? "REVIEW" : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print: Drawings */}
        {drawings.length > 0 && (
          <div className="mt-4 page-break-before">
            <h2 className="text-base font-bold mb-2">
              Relevant Drawings ({relevantCount} of {drawings.length})
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Page</th>
                  <th className="text-left py-1">Sheet</th>
                  <th className="text-left py-1">Title</th>
                  <th className="text-left py-1">Discipline</th>
                  <th className="text-left py-1">Relevance</th>
                </tr>
              </thead>
              <tbody>
                {drawings
                  .filter((d) => d.relevanceToFlooring === "high" || d.relevanceToFlooring === "medium")
                  .map((d, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-1">{d.pageNumber}</td>
                      <td className="py-1">{d.sheetId}</td>
                      <td className="py-1">{d.sheetTitle || "\u2014"}</td>
                      <td className="py-1">{d.discipline.replace(/_/g, " ")}</td>
                      <td className="py-1">{d.relevanceToFlooring}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print: Specs */}
        {specExtractions.length > 0 && (
          <div className="mt-4 page-break-before">
            <h2 className="text-base font-bold mb-2">Spec Products</h2>
            {specExtractions.map((ext, ei) => (
              <div key={ei}>
                {ext.gotchas.length > 0 && (
                  <div className="mb-3 border-2 border-gray-400 p-3 rounded">
                    <h3 className="text-sm font-bold mb-1">GOTCHAS</h3>
                    {ext.gotchas.map((g, i) => (
                      <div key={i} className="text-sm">
                        ! {typeof g === "string" ? g : (g as { description: string }).description}
                      </div>
                    ))}
                  </div>
                )}
                {ext.products.map((p, pi) => (
                  <div key={pi} className="mb-2 text-sm">
                    <strong>{p.csiSection} {p.sectionTitle}</strong>
                    {p.productName && <span> — {p.productName}</span>}
                    <br />
                    Manufacturers: {p.manufacturers.map((m) => m.name).join(", ")}
                    {p.installMethod && <> | Install: {p.installMethod}</>}
                    {p.installPattern && <> | Pattern: {p.installPattern}</>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t text-xs text-gray-500">
          Generated by Standard Interiors Estimator Tool
        </div>
      </div>
    </div>
  );
}
