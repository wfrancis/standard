"use client";

import { useState } from "react";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { BidSummary } from "@/lib/schemas/bid";
import type { SpecExtraction } from "@/lib/schemas/spec";

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

const tabs = ["Summary", "Drawings", "Specs"] as const;
type Tab = (typeof tabs)[number];

export default function ProjectDetailClient({
  project,
  bidSummary,
  drawings,
  specExtractions,
}: {
  project: ProjectInfo;
  bidSummary: BidSummary | null;
  drawings: DrawingItem[];
  specExtractions: SpecExtraction[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Summary");

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {project.gcName && <span>GC: {project.gcName}</span>}
          {project.bidDate && (
            <span>
              Bid: {project.bidDate}
              {project.bidTime ? ` at ${project.bidTime}` : ""}
            </span>
          )}
          <span className="capitalize px-2 py-0.5 rounded bg-gray-100 text-xs font-medium">
            {project.status}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
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
                  ({drawings.length})
                </span>
              )}
              {tab === "Specs" && specExtractions.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({specExtractions.reduce((acc, s) => acc + s.products.length, 0)}{" "}
                  products)
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Tab */}
      {activeTab === "Summary" && (
        <div className="space-y-6">
          {bidSummary ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Bid Summary
                </h2>
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
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {bidSummary.projectLocation && (
                    <div>
                      <span className="text-gray-500">Location:</span>{" "}
                      {bidSummary.projectLocation}
                    </div>
                  )}
                  {bidSummary.owner && (
                    <div>
                      <span className="text-gray-500">Owner:</span>{" "}
                      {bidSummary.owner}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">GC:</span>{" "}
                    {bidSummary.gcName}
                  </div>
                  <div>
                    <span className="text-gray-500">Bid Date:</span>{" "}
                    {bidSummary.bidDate}{" "}
                    <ConfidenceBadge level={bidSummary.confidence.bidDate} />
                  </div>
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
                          <td className="py-2 pr-4 text-gray-600">{s.approxSF || "—"}</td>
                          <td className="py-2 text-gray-600">{s.product || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>No bid summary available for this project.</p>
            </div>
          )}
        </div>
      )}

      {/* Drawings Tab */}
      {activeTab === "Drawings" && (
        <div>
          {drawings.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Page</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Sheet ID</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Discipline</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Relevance</th>
                  </tr>
                </thead>
                <tbody>
                  {drawings.map((d, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-3">{d.pageNumber}</td>
                      <td className="px-4 py-3 font-mono">{d.sheetId}</td>
                      <td className="px-4 py-3">{d.sheetTitle || "—"}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>No drawings have been classified for this project.</p>
            </div>
          )}
        </div>
      )}

      {/* Specs Tab */}
      {activeTab === "Specs" && (
        <div className="space-y-6">
          {specExtractions.length > 0 ? (
            specExtractions.map((extraction, ei) => (
              <div key={ei} className="space-y-4">
                {extraction.gotchas.length > 0 && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-3">
                      Gotchas
                    </h3>
                    <ul className="space-y-1.5">
                      {extraction.gotchas.map((g, i) => (
                        <li key={i} className="text-sm text-yellow-900">! {g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {extraction.products.map((product, pi) => (
                  <div
                    key={pi}
                    className="bg-white rounded-xl border border-gray-200 p-6"
                  >
                    <h4 className="font-semibold text-gray-900">
                      {product.sectionTitle}
                    </h4>
                    <p className="text-xs text-gray-500 font-mono">
                      {product.csiSection}
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                      <div className="col-span-2">
                        <span className="text-gray-500">Manufacturers:</span>{" "}
                        {product.manufacturers.map((m) => m.name).join(", ")}
                      </div>
                      {product.installMethod && (
                        <div>
                          <span className="text-gray-500">Install:</span>{" "}
                          {product.installMethod}
                        </div>
                      )}
                      {product.installPattern && (
                        <div>
                          <span className="text-gray-500">Pattern:</span>{" "}
                          {product.installPattern}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>No specs have been extracted for this project.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
