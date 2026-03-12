"use client";

import { useEffect, useState, useCallback } from "react";

interface AgentJob {
  id: string;
  type: string;
  status: string;
  project_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface AgentStatus {
  enabled: boolean;
  running: AgentJob[];
  recent: AgentJob[];
  stats: { pending: number; running: number; completed: number; failed: number };
}

const typeLabels: Record<string, string> = {
  bid_intake: "Bid Intake",
  drawing_sort: "Drawing Sort",
  spec_read: "Spec Read",
};

export default function AgentStatusBar() {
  const [status, setStatus] = useState<AgentStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // Silently fail — status bar is non-critical
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) return null;

  const { running, stats } = status;
  const isActive = running.length > 0;
  const hasActivity = stats.completed > 0 || stats.failed > 0 || stats.pending > 0;

  if (!status.enabled && !hasActivity) return null;

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center justify-between text-xs">
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isActive ? "bg-green-500 animate-pulse" : status.enabled ? "bg-slate-300" : "bg-slate-200"
            }`}
          />
          <span className="font-medium text-slate-600">
            {isActive ? "Agent Running" : status.enabled ? "Agent Idle" : "Agent Off"}
          </span>
        </div>

        {/* Current job info */}
        {running.length > 0 && (
          <span className="text-slate-500">
            {typeLabels[running[0].type] || running[0].type}
            {running.length > 1 && ` +${running.length - 1} more`}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-slate-400">
        {stats.pending > 0 && (
          <span className="text-amber-600">{stats.pending} queued</span>
        )}
        {stats.completed > 0 && (
          <span className="text-green-600">{stats.completed} done</span>
        )}
        {stats.failed > 0 && (
          <span className="text-red-600">{stats.failed} failed</span>
        )}
      </div>
    </div>
  );
}
