"use client";

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low";
  sourceText?: string;
}

export default function ConfidenceBadge({ level, sourceText }: ConfidenceBadgeProps) {
  if (level === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600" title={sourceText || "Extracted verbatim from source"}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  if (level === "medium") {
    return (
      <span
        className="inline-flex items-center gap-1 text-yellow-600 cursor-help"
        title={sourceText || "AI interpreted — verify"}
      >
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
      VERIFY
    </span>
  );
}
