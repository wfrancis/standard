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

function getUrgencyBand(bidDate: string | null): { label: string; color: string } | null {
  if (!bidDate) return null;
  const now = new Date();
  const due = new Date(bidDate);
  const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 0) return { label: "PAST DUE", color: "bg-gray-500" };
  if (hoursUntil <= 48) return { label: "DUE SOON", color: "bg-red-500" };
  if (hoursUntil <= 168) return { label: "THIS WEEK", color: "bg-yellow-500" };
  return null;
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
  const urgency = getUrgencyBand(bidDate);

  const stages = [
    { label: "Bid", done: true }, // always true since project exists from bid parse
    { label: "Drawings", done: drawingCount > 0 },
    { label: "Specs", done: specCount > 0 },
  ];

  const completedCount = stages.filter((s) => s.done).length;

  return (
    <Link href={`/projects/${id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-5">
        {urgency && (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white mb-3 ${urgency.color}`}>
            {urgency.label}
          </span>
        )}
        <h3 className="font-semibold text-gray-900 text-base">{name}</h3>
        {gcName && (
          <p className="text-sm text-gray-500 mt-1">GC: {gcName}</p>
        )}
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
