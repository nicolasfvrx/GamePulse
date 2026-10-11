export interface DayZServerStatus {
  server_ip: string;
  query_port: number;
  game_port?: number;
  is_online: boolean;
  server_name: string;
  map_name: string;
  players_count: number;
  max_players: number;
  bots_count: number;
  ping_ms: number;
  environment: string;
  game_version?: string;
  last_queried_at: string;
  error?: string | null;
}

export interface ServerStatusLog {
  id: number;
  bot_id: string;
  server_ip: string;
  query_port: number;
  is_online: boolean;
  server_name: string;
  map_name: string;
  players_count: number;
  max_players: number;
  ping_ms: number;
  recorded_at: string;
}
