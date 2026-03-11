"use client";

import Link from "next/link";

interface ProjectCardProps {
  id: string;
  name: string;
  gcName: string | null;
  bidDate: string | null;
  bidTime: string | null;
  status: string;
  itemsReady?: number;
  totalItems?: number;
  needsReview?: number;
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
  itemsReady = 0,
  totalItems = 3,
  needsReview = 0,
}: ProjectCardProps) {
  const urgency = getUrgencyBand(bidDate);

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
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{itemsReady} of {totalItems} ready</span>
            {needsReview > 0 && (
              <span className="text-yellow-600 font-medium">
                {needsReview} needs review
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(itemsReady / totalItems) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
