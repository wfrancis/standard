import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '@/lib/agents/queue';
import type { JobType } from '@/lib/agents/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, projectId } = body as {
      type: JobType;
      payload: Record<string, unknown>;
      projectId?: string;
    };

    if (!type || !['bid_intake', 'drawing_sort', 'spec_read'].includes(type)) {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    const jobId = enqueueJob(type, payload || {}, projectId);
    return NextResponse.json({ jobId });
  } catch (err) {
    console.error('Job enqueue error:', err);
    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 });
  }
}
