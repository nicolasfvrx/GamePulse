import type { DayZServerStatus } from './server.js';

export type BotStatus = 'active' | 'paused' | 'error' | 'stopped';

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
  server_query_port: number;
  server_game_port?: number | null;
  refresh_interval_secs?: number;
  worker_id?: string | null;
  activity_format?: string;
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
  status?: BotStatus;
}
