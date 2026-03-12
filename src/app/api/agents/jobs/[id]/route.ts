import { NextRequest, NextResponse } from 'next/server';
import { getJobById, getJobLogs, retryJob } from '@/lib/agents/queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const logs = getJobLogs(params.id);
    return NextResponse.json({ job, logs });
  } catch (err) {
    console.error('Job detail error:', err);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status !== 'failed') {
      return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 });
    }

    retryJob(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Job retry error:', err);
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
