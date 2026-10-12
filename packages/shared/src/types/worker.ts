export type WorkerStatus = 'online' | 'offline' | 'degraded';

export interface WorkerMetrics {
  cpu_usage_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  uptime_seconds: number;
}

export interface Worker {
  id: string;
  name: string;
  hostname: string;
  version: string;
  status: WorkerStatus;
  cpu_usage_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  uptime_seconds: number;
  active_bots_count: number;
  api_key?: string;
  api_key_preview?: string;
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerInput {
  id: string;
  name: string;
  hostname?: string;
  version?: string;
  api_key?: string;
}

export interface CreateWorkerResponse {
  worker: Worker;
  api_key: string;
}

export interface UpdateWorkerInput {
  name?: string;
  hostname?: string;
  version?: string;
  api_key?: string;
}
