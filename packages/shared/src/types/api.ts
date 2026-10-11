export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface OverviewStats {
  total_workers: number;
  online_workers: number;
  total_bots: number;
  active_bots: number;
  online_servers: number;
  total_players_tracked: number;
}
