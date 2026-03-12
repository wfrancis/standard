"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AgentJob {
  id: string;
  type: string;
  project_id: string | null;
  status: string;
  payload_json: string;
  result_json: string | null;
  attempt: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export default function AgentDashboardClient() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [stats, setStats] = useState<JobStats>({ pending: 0, running: 0, completed: 0, failed: 0 });
  const [enabled, setEnabled] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/status");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.recent || []);
      setStats(data.stats || { pending: 0, running: 0, completed: 0, failed: 0 });
      setEnabled(data.enabled || false);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      await fetch(`/api/agents/jobs/${jobId}`, { method: "POST" });
      await fetchStatus();
    } finally {
      setRetrying(null);
    }
  };

  const filteredJobs = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "running": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const jobTypeLabel = (type: string) => {
    switch (type) {
      case "bid_intake": return "Bid Intake";
      case "drawing_sort": return "Drawing Sort";
      case "spec_read": return "Spec Read";
      default: return type;
    }
  };

  const getJobSubject = (job: AgentJob): string => {
    try {
      const payload = JSON.parse(job.payload_json);
      return payload.subject || payload.filename || "—";
    } catch {
      return "—";
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso + "Z");
      return d.toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <nav className="text-sm text-slate-500 mb-1">
            <Link href="/" className="hover:text-blue-600">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-800">Agents</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-900">Agent Dashboard</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {enabled ? "● Enabled" : "○ Disabled"}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-slate-500 mt-1">Pending</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
          <div className="text-sm text-slate-500 mt-1">Running</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-slate-500 mt-1">Completed</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-slate-500 mt-1">Failed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {["all", "pending", "running", "completed", "failed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f
                ? "bg-slate-800 text-white"
                : "bg-white border text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${f === "pending" ? stats.pending : f === "running" ? stats.running : f === "completed" ? stats.completed : stats.failed})`}
          </button>
        ))}
      </div>

      {/* Job table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Subject / File</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Attempts</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {filter === "all" ? "No agent jobs yet." : `No ${filter} jobs.`}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{jobTypeLabel(job.type)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{getJobSubject(job)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{job.attempt}/{job.max_attempts}</td>
                  <td className="px-4 py-3 text-slate-500">{formatTime(job.created_at)}</td>
                  <td className="px-4 py-3">
                    {job.project_id ? (
                      <Link href={`/projects/${job.project_id}`} className="text-blue-600 hover:underline text-xs">
                        View
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {job.status === "failed" && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={retrying === job.id}
                        className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        {retrying === job.id ? "Retrying..." : "Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
