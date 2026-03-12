import { NextResponse } from 'next/server';
import { getRecentJobs, getJobStats } from '@/lib/agents/queue';
import type { AgentJob } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const recent = getRecentJobs(20);
    const stats = getJobStats();
    const running = recent.filter((j: AgentJob) => j.status === 'running');

    return NextResponse.json({
      enabled: process.env.AGENT_ENABLED === 'true',
      running,
      recent,
      stats,
    });
  } catch (err) {
    console.error('Agent status error:', err);
    return NextResponse.json({ error: 'Failed to fetch agent status' }, { status: 500 });
  }
}
