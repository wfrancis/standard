"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import type { DrawingClassification } from "@/lib/schemas/drawing";

type RelevanceFilter = "all" | "high" | "medium" | "low";

const relevanceColors: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-600",
  none: "bg-gray-50 text-gray-400",
};

export default function DrawingsPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [classifications, setClassifications] = useState<DrawingClassification[]>([]);
  const [summary, setSummary] = useState<{
    highRelevance: number;
    mediumRelevance: number;
    lowRelevance: number;
    noRelevance: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RelevanceFilter>("all");

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setClassifications([]);
    setSummary(null);
    setProgress(0);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/drawings", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to classify drawings");
      }

      const data = await res.json();
      setClassifications(data.classifications ?? []);
      setSummary(data.summary ?? null);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  }

  const filtered =
    filter === "all"
      ? classifications
      : classifications.filter((c) => c.relevanceToFlooring === filter);

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Drawing Classification</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload a drawing set PDF to identify sheets relevant to flooring scope.
      </p>

      {classifications.length === 0 && !loading && (
        <FileUpload
          label="Upload Drawing Set"
          description="Drag and drop a drawing set PDF, or click to browse"
          onFile={handleFile}
        />
      )}

      {loading && (
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Classifying sheets...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {classifications.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Summary bar */}
          {summary && (
            <div className="flex gap-4">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{summary.highRelevance}</div>
                <div className="text-xs text-green-600 mt-1">High Relevance</div>
              </div>
              <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-700">{summary.mediumRelevance}</div>
                <div className="text-xs text-yellow-600 mt-1">Medium</div>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-500">{summary.lowRelevance}</div>
                <div className="text-xs text-gray-500 mt-1">Low</div>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-400">{summary.noRelevance}</div>
                <div className="text-xs text-gray-400 mt-1">None</div>
              </div>
            </div>
          )}

          {/* Filter buttons */}
          <div className="flex gap-2">
            {(["all", "high", "medium", "low"] as RelevanceFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Classification table */}
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
                {filtered.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{c.pageNumber}</td>
                    <td className="px-4 py-3 font-mono text-gray-900">{c.sheetId}</td>
                    <td className="px-4 py-3 text-gray-700">{c.sheetTitle || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.discipline.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          relevanceColors[c.relevanceToFlooring]
                        }`}
                      >
                        {c.relevanceToFlooring.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {c.flooringNotes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => {
              setClassifications([]);
              setSummary(null);
              setFilter("all");
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Upload Another Set
          </button>
        </div>
      )}
    </div>
  );
}
