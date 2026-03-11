"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { SpecExtraction } from "@/lib/schemas/spec";

export default function SpecsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/specs", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to extract specs");
      }

      const data = await res.json();
      setResult(data.extraction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleTextSubmit() {
    if (!textContent.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textContent }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to extract specs");
      }

      const data = await res.json();
      setResult(data.extraction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Spec Extraction</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload a project manual PDF or paste spec text to extract Division 09 flooring specifications.
      </p>

      {!result && !loading && (
        <div className="space-y-6">
          <div>
            <label htmlFor="spec-content" className="block text-sm font-medium text-gray-700 mb-2">
              Paste Spec Text
            </label>
            <textarea
              id="spec-content"
              rows={10}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste Division 09 specification text here..."
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textContent.trim()}
              className="mt-3 w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Extract Specs
            </button>
          </div>

          <FileUpload
            label="Or Upload Project Manual"
            description="Drag and drop a spec book PDF, or click to browse"
            onFile={handleFile}
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-sm text-gray-500">
              Extracting Division 09 specifications...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              {result.projectName && (
                <h2 className="text-xl font-semibold text-gray-900">
                  {result.projectName}
                </h2>
              )}
              {result.specDate && (
                <p className="text-sm text-gray-500 mt-1">
                  Spec Date: {result.specDate}
                </p>
              )}
            </div>
            <ConfidenceBadge level={result.confidence} />
          </div>

          {/* Gotchas */}
          {result.gotchas.length > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
              <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-4">
                Gotchas — Commonly Missed Cost Items
              </h3>
              <ul className="space-y-2">
                {result.gotchas.map((gotcha, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-yellow-900">
                    <span className="mt-0.5 font-bold">!</span>
                    {gotcha}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Moisture Testing */}
          {result.moistureTestingSection && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-4">
                Moisture Testing
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {result.moistureTestingSection.protocol && (
                  <div>
                    <span className="text-blue-600">Protocol:</span>{" "}
                    <span className="text-blue-900">
                      {result.moistureTestingSection.protocol}
                    </span>
                  </div>
                )}
                {result.moistureTestingSection.frequency && (
                  <div>
                    <span className="text-blue-600">Frequency:</span>{" "}
                    <span className="text-blue-900">
                      {result.moistureTestingSection.frequency}
                    </span>
                  </div>
                )}
                {result.moistureTestingSection.responsibleParty && (
                  <div>
                    <span className="text-blue-600">Responsible Party:</span>{" "}
                    <span className="text-blue-900">
                      {result.moistureTestingSection.responsibleParty}
                    </span>
                  </div>
                )}
                {result.moistureTestingSection.acceptableLimits && (
                  <div>
                    <span className="text-blue-600">Acceptable Limits:</span>{" "}
                    <span className="text-blue-900">
                      {result.moistureTestingSection.acceptableLimits}
                    </span>
                  </div>
                )}
                {result.moistureTestingSection.mitigationProducts.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-blue-600">Mitigation Products:</span>{" "}
                    <span className="text-blue-900">
                      {result.moistureTestingSection.mitigationProducts.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Cards */}
          <h3 className="text-lg font-semibold text-gray-900">
            Flooring Products ({result.products.length})
          </h3>
          {result.products.map((product, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {product.sectionTitle}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {product.csiSection}
                  </p>
                </div>
                {product.productName && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {product.productName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Manufacturers */}
                <div className="col-span-2">
                  <span className="text-gray-500">Manufacturers:</span>{" "}
                  {product.manufacturers.map((m, j) => (
                    <span key={j} className="text-gray-900">
                      {m.name}
                      {m.isBasisOfDesign && (
                        <span className="text-xs text-blue-600 ml-1">(BOD)</span>
                      )}
                      {j < product.manufacturers.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
                {product.colors && (
                  <div>
                    <span className="text-gray-500">Colors:</span>{" "}
                    <span className="text-gray-900">{product.colors}</span>
                  </div>
                )}
                {product.dimensions && (
                  <div>
                    <span className="text-gray-500">Dimensions:</span>{" "}
                    <span className="text-gray-900">{product.dimensions}</span>
                  </div>
                )}
                {product.installMethod && (
                  <div>
                    <span className="text-gray-500">Install Method:</span>{" "}
                    <span className="text-gray-900">{product.installMethod}</span>
                  </div>
                )}
                {product.installPattern && (
                  <div>
                    <span className="text-gray-500">Pattern:</span>{" "}
                    <span className="text-gray-900">{product.installPattern}</span>
                  </div>
                )}
                {product.seamRequirements && (
                  <div>
                    <span className="text-gray-500">Seams:</span>{" "}
                    <span className="text-gray-900">{product.seamRequirements}</span>
                  </div>
                )}
                {product.flashCoveBase && (
                  <div>
                    <span className="text-gray-500">Flash Cove/Base:</span>{" "}
                    <span className="text-gray-900">{product.flashCoveBase}</span>
                  </div>
                )}
                {product.atticStockPercent && (
                  <div>
                    <span className="text-gray-500">Attic Stock:</span>{" "}
                    <span className="text-gray-900">{product.atticStockPercent}</span>
                  </div>
                )}
                {product.warranty && (
                  <div>
                    <span className="text-gray-500">Warranty:</span>{" "}
                    <span className="text-gray-900">{product.warranty}</span>
                  </div>
                )}
                {product.moistureLimits && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Moisture Limits:</span>{" "}
                    <span className="text-gray-900">{product.moistureLimits}</span>
                  </div>
                )}
              </div>

              {product.specialNotes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Special Notes
                  </p>
                  <ul className="space-y-1">
                    {product.specialNotes.map((note, j) => (
                      <li key={j} className="text-xs text-gray-600">
                        - {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* General Notes */}
          {result.generalNotes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                General Notes
              </h3>
              <ul className="space-y-2">
                {result.generalNotes.map((note, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    - {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submittal Requirements */}
          {result.submittalRequirements && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Submittal Requirements
              </h3>
              <p className="text-sm text-gray-700">{result.submittalRequirements}</p>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Upload Another Spec
          </button>
        </div>
      )}
    </div>
  );
}
