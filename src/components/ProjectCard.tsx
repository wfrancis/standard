"use client";

import Link from "next/link";

interface ProjectCardProps {
  id: string;
  name: string;
  gcName: string | null;
  bidDate: string | null;
  bidTime: string | null;
  status: string;
  drawingCount?: number;
  specCount?: number;
}

function getDaysUntil(bidDate: string | null): { label: string; color: string } | null {
  if (!bidDate) return null;
  const now = new Date();
  const due = new Date(bidDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: "PAST DUE", color: "bg-gray-500" };
  if (diffDays === 0) return { label: "DUE TODAY", color: "bg-red-600" };
  if (diffDays === 1) return { label: "TOMORROW", color: "bg-red-500" };
  if (diffDays <= 3) return { label: `${diffDays} DAYS`, color: "bg-red-500" };
  if (diffDays <= 7) return { label: `${diffDays} DAYS`, color: "bg-yellow-500" };
  if (diffDays <= 14) return { label: `${diffDays} DAYS`, color: "bg-blue-500" };
  return { label: `${diffDays} DAYS`, color: "bg-gray-400" };
}

export default function ProjectCard({
  id,
  name,
  gcName,
  bidDate,
  bidTime,
  drawingCount = 0,
  specCount = 0,
}: ProjectCardProps) {
  const countdown = getDaysUntil(bidDate);

  const stages = [
    { label: "Bid", done: true },
    { label: "Drawings", done: drawingCount > 0 },
    { label: "Specs", done: specCount > 0 },
  ];

  const completedCount = stages.filter((s) => s.done).length;

  return (
    <Link href={`/projects/${id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">{name}</h3>
            {gcName && (
              <p className="text-sm text-gray-500 mt-1">GC: {gcName}</p>
            )}
          </div>
          {countdown && (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ml-2 flex-shrink-0 ${countdown.color}`}>
              {countdown.label}
            </span>
          )}
        </div>

        {bidDate && (
          <p className="text-sm text-gray-600 mt-1">
            Bid: {bidDate}{bidTime ? ` at ${bidTime}` : ""}
          </p>
        )}

        {/* Pipeline stages */}
        <div className="mt-4 flex items-center gap-2">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  stage.done
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {stage.done ? "\u2713" : "\u2014"}
              </span>
              <span className={`text-xs ${stage.done ? "text-green-700 font-medium" : "text-gray-400"}`}>
                {stage.label}
              </span>
              {i < stages.length - 1 && (
                <span className="text-gray-300 text-xs mx-0.5">&rarr;</span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(completedCount / stages.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
