import type { DayZServerStatus } from './server.js';

export type BotStatus = 'active' | 'paused' | 'error' | 'stopped';
export type QueryType = 'a2s' | 'cftools';

export interface Bot {
  id: string;
  name: string;
  discord_token: string;
  discord_client_id: string;
  server_ip: string;
  server_query_port: number;
  server_game_port?: number | null;
  refresh_interval_secs: number;
  worker_id: string | null;
  status: BotStatus;
  activity_format: string;
  query_type: QueryType;
  cftools_server_id?: string | null;
  custom_status_enabled: boolean;
  custom_status_text?: string | null;
  last_queue_size?: number;
  last_status?: DayZServerStatus | null;
  created_at: string;
  updated_at: string;
}

export type BotSanitized = Omit<Bot, 'discord_token'> & {
  has_token: boolean;
  token_preview: string;
};

export interface CreateBotInput {
  name: string;
  discord_token: string;
  discord_client_id: string;
  server_ip: string;
  server_query_port?: number;
  server_game_port?: number | null;
  refresh_interval_secs?: number;
  worker_id?: string | null;
  activity_format?: string;
  query_type?: QueryType;
  cftools_server_id?: string | null;
  custom_status_enabled?: boolean;
  custom_status_text?: string | null;
  status?: BotStatus;
}

export interface UpdateBotInput {
  name?: string;
  discord_token?: string;
  discord_client_id?: string;
  server_ip?: string;
  server_query_port?: number;
  server_game_port?: number | null;
  refresh_interval_secs?: number;
  worker_id?: string | null;
  activity_format?: string;
  query_type?: QueryType;
  cftools_server_id?: string | null;
  custom_status_enabled?: boolean;
  custom_status_text?: string | null;
  status?: BotStatus;
}
