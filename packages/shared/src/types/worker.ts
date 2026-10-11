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
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerInput {
  id: string;
  name: string;
  hostname?: string;
  version?: string;
}

export interface UpdateWorkerInput {
  name?: string;
  hostname?: string;
  version?: string;
}
