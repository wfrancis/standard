"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { BidSummary } from "@/lib/schemas/bid";

export default function BidIntakePage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BidSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to process bid invite");
      }

      const data = await res.json();
      setResult(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setContent(text);
      }
    };
    reader.readAsText(file);
  }

  const recommendationColors: Record<string, string> = {
    BID: "bg-green-100 text-green-800 border-green-200",
    PASS: "bg-red-100 text-red-800 border-red-200",
    NEEDS_MORE_INFO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bid Intake</h1>
      <p className="text-sm text-gray-500 mb-8">
        Paste a bid invite email or upload a document to extract project details.
      </p>

      {!result && (
        <div className="space-y-6">
          <div>
            <label
              htmlFor="bid-content"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Bid Invite Content
            </label>
            <textarea
              id="bid-content"
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the bid invitation email here..."
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
            />
          </div>

          <FileUpload
            label="Or Upload a Document"
            description="Drag and drop a bid invite PDF, or click to browse"
            accept=".pdf,.txt,.doc,.docx"
            onFile={handleFileUpload}
          />

          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              "Process Bid Invite"
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Header with recommendation */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {result.projectName}
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold border ${
                recommendationColors[result.recommendation]
              }`}
            >
              {result.recommendation.replace("_", " ")}
            </span>
          </div>

          {/* Project Details Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Project Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {result.projectLocation && (
                <div>
                  <span className="text-gray-500">Location:</span>{" "}
                  <span className="text-gray-900">{result.projectLocation}</span>
                </div>
              )}
              {result.owner && (
                <div>
                  <span className="text-gray-500">Owner:</span>{" "}
                  <span className="text-gray-900">{result.owner}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">General Contractor:</span>{" "}
                <span className="text-gray-900">{result.gcName}</span>
              </div>
              {result.gcEstimator && (
                <div>
                  <span className="text-gray-500">Estimator:</span>{" "}
                  <span className="text-gray-900">{result.gcEstimator}</span>
                </div>
              )}
              {result.gcEmail && (
                <div>
                  <span className="text-gray-500">Email:</span>{" "}
                  <span className="text-gray-900">{result.gcEmail}</span>
                </div>
              )}
              {result.gcPhone && (
                <div>
                  <span className="text-gray-500">Phone:</span>{" "}
                  <span className="text-gray-900">{result.gcPhone}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Bid Date:</span>{" "}
                <span className="text-gray-900 font-medium">
                  {result.bidDate}
                  {result.bidTime ? ` at ${result.bidTime}` : ""}
                </span>{" "}
                <ConfidenceBadge level={result.confidence.bidDate} />
              </div>
              {result.preBidDate && (
                <div>
                  <span className="text-gray-500">Pre-Bid:</span>{" "}
                  <span className="text-gray-900">
                    {result.preBidDate}
                    {result.preBidMandatory ? " (MANDATORY)" : ""}
                  </span>
                </div>
              )}
              {result.prevailingWage !== undefined && (
                <div>
                  <span className="text-gray-500">Prevailing Wage:</span>{" "}
                  <span className="text-gray-900">
                    {result.prevailingWage ? "Yes" : "No"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Scope Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Scope
              </h3>
              <ConfidenceBadge level={result.confidence.scope} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">
                      Flooring Type
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">
                      Approx SF
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">
                      Product
                    </th>
                    <th className="text-left py-2 font-medium text-gray-500">
                      Manufacturer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.scope.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-900">
                        {item.flooringType}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {item.approxSF || "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {item.product || "—"}
                      </td>
                      <td className="py-2 text-gray-600">
                        {item.manufacturer || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Notes */}
          {result.keyNotes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Key Notes
              </h3>
              <ul className="space-y-2">
                {result.keyNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5">&#8226;</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {result.risks.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-6">
              <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-4">
                Risks
              </h3>
              <ul className="space-y-2">
                {result.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                    <span className="mt-0.5">&#9888;</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing Documents */}
          {result.missingDocuments.length > 0 && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
              <h3 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide mb-4">
                Missing Documents
              </h3>
              <ul className="space-y-2">
                {result.missingDocuments.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-yellow-800">
                    <span className="mt-0.5">&#8226;</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Moisture Responsibility */}
          {result.moistureResponsibility && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Moisture Responsibility
              </h3>
              <p className="text-sm text-gray-700">{result.moistureResponsibility}</p>
            </div>
          )}

          {/* Overall Confidence */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Overall Confidence: <ConfidenceBadge level={result.confidence.overall} />
            <span className="capitalize">{result.confidence.overall}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setResult(null);
                setContent("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Process Another
            </button>
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
