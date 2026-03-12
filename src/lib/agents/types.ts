export type JobType = 'bid_intake' | 'drawing_sort' | 'spec_read';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentJob {
  id: string;
  type: JobType;
  project_id: string | null;
  status: JobStatus;
  payload_json: string;
  result_json: string | null;
  attempt: number;
  max_attempts: number;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface BidIntakePayload {
  email_uid: string;
  subject: string;
  from: string;
  body: string;
  attachments: { filename: string; path: string }[];
}

export interface DrawingSortPayload {
  project_id: string;
  pdf_path: string;
  filename: string;
}

export interface SpecReadPayload {
  project_id: string;
  pdf_path: string;
  filename: string;
}

export interface AgentLogEntry {
  id: number;
  job_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}
