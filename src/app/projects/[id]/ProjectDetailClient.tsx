"use client";

import { useState, useMemo } from "react";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import FileUpload from "@/components/FileUpload";
import type { BidSummary } from "@/lib/schemas/bid";
import type { SpecExtraction } from "@/lib/schemas/spec";
import type { DrawingClassification } from "@/lib/schemas/drawing";
import { crossReferenceScope, type ScopeMatch } from "@/lib/scope-matcher";
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

const tabs = ["Summary", "Drawings", "Specs", "Export"] as const;
type Tab = (typeof tabs)[number];

export default function ProjectDetailClient({
  project,
  bidSummary,
  drawings: initialDrawings,
  specExtractions: initialSpecs,
}: {
  project: ProjectInfo;
  bidSummary: BidSummary | null;
  drawings: DrawingItem[];
  specExtractions: SpecExtraction[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [drawings, setDrawings] = useState<DrawingItem[]>(initialDrawings);
  const [specExtractions, setSpecExtractions] = useState<SpecExtraction[]>(initialSpecs);
  const [drawingFilter, setDrawingFilter] = useState<"all" | "relevant">("relevant");
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [drawingProgress, setDrawingProgress] = useState(0);
  const [specLoading, setSpecLoading] = useState(false);
  const [specText, setSpecText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  const scopeMatches = useMemo<ScopeMatch[]>(() => {
    if (!bidSummary || specExtractions.length === 0) return [];
    return crossReferenceScope(bidSummary, specExtractions);
  }, [bidSummary, specExtractions]);

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

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
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
              {bidSummary.recommendation.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {project.gcName && <span>GC: {project.gcName}</span>}
          {project.bidDate && (
            <span>
              Bid: {project.bidDate}
              {project.bidTime ? ` at ${project.bidTime}` : ""}
            </span>
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
                      <span className="text-gray-500">Location:</span> {bidSummary.projectLocation}
                    </div>
                  )}
                  {bidSummary.owner && (
                    <div>
                      <span className="text-gray-500">Owner:</span> {bidSummary.owner}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">GC:</span> {bidSummary.gcName}
                  </div>
                  <div>
                    <span className="text-gray-500">Bid Date:</span> {bidSummary.bidDate}{" "}
                    <ConfidenceBadge level={bidSummary.confidence.bidDate} />
                  </div>
                  {bidSummary.gcEstimator && (
                    <div>
                      <span className="text-gray-500">Estimator:</span> {bidSummary.gcEstimator}
                    </div>
                  )}
                  {bidSummary.gcEmail && (
                    <div>
                      <span className="text-gray-500">Email:</span> {bidSummary.gcEmail}
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
                        <th className="text-left py-2 font-medium text-gray-500">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidSummary.scope.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-4">{s.flooringType}</td>
                          <td className="py-2 pr-4 text-gray-600">{s.approxSF || "\u2014"}</td>
                          <td className="py-2 text-gray-600">{s.product || "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                            : match.status === "unmatched"
                            ? "bg-red-50 text-red-800"
                            : "bg-yellow-50 text-yellow-800"
                        }`}
                      >
                        <span className="mt-0.5 font-bold">
                          {match.status === "matched"
                            ? "\u2713"
                            : match.status === "unmatched"
                            ? "\u2717"
                            : "!"}
                        </span>
                        <span>{match.note}</span>
                      </div>
                    ))}
                  </div>
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
              Print a complete project summary including bid details, relevant drawings, spec products, and gotchas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Print / Save as PDF
              </button>
              {bidSummary && (
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied ? "Copied!" : "Copy Summary to Clipboard"}
                </button>
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

      {/* ========== PRINT-ONLY LAYOUT ========== */}
      <div className="print-only hidden">
        <div className="print-header">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {project.gcName && <span>GC: {project.gcName} | </span>}
            {project.bidDate && <span>Bid: {project.bidDate}</span>}
            {bidSummary && <span> | {bidSummary.recommendation.replace("_", " ")}</span>}
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
              <div>Bid: {bidSummary.bidDate}</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {bidSummary.scope.map((s, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1">{s.flooringType}</td>
                        <td className="py-1">{s.approxSF || "\u2014"}</td>
                        <td className="py-1">{s.product || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                {m.status === "matched" ? "\u2713" : m.status === "unmatched" ? "\u2717" : "!"} {m.note}
              </div>
            ))}
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
