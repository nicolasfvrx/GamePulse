import type { WorkerMetrics } from './worker.js';
import type { DayZServerStatus } from './server.js';

export interface WorkerHeartbeatPayload {
  worker_id: string;
  version: string;
  hostname?: string;
  metrics: WorkerMetrics;
  active_bot_ids: string[];
  server_statuses?: Record<string, DayZServerStatus>;
}

export interface WorkerHeartbeatResponse {
  success: boolean;
  acknowledged_at: string;
  assigned_bots_count: number;
  message?: string;
}
