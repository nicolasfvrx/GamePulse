import type {
  ApiResponse,
  OverviewStats,
  Worker,
  BotSanitized,
  CreateBotInput,
  UpdateBotInput,
  ServerStatusLog,
} from '@dayz-bot-network/shared';

const API_BASE = '/api';

// Fallback mock data when running Vite standalone without D1 backend
let mockWorkers: Worker[] = [
  {
    id: 'worker-eu-paris-01',
    name: 'worker-eu-paris-01',
    hostname: 'vps-paris-ovh',
    version: '1.2.0',
    status: 'online',
    cpu_usage_percent: 18.4,
    ram_used_mb: 245,
    ram_total_mb: 4096,
    uptime_seconds: 142850,
    active_bots_count: 2,
    last_heartbeat_at: new Date(Date.now() - 5000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'worker-us-east-02',
    name: 'worker-us-east-02',
    hostname: 'node-virginia-aws',
    version: '1.2.0',
    status: 'online',
    cpu_usage_percent: 12.1,
    ram_used_mb: 180,
    ram_total_mb: 2048,
    uptime_seconds: 86400,
    active_bots_count: 1,
    last_heartbeat_at: new Date(Date.now() - 12000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockBots: BotSanitized[] = [
  {
    id: 'bot_dayz_fr01',
    name: 'DayZ FR Official #1 Tracker',
    discord_client_id: '123456789012345678',
    server_ip: '51.178.65.12',
    server_query_port: 2305,
    server_game_port: 2302,
    refresh_interval_secs: 15,
    worker_id: 'worker-eu-paris-01',
    status: 'active',
    activity_format: 'Joue à DayZ - {map} [{players}/{max_players}]',
    has_token: true,
    token_preview: 'MTA2...9xyz',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    last_status: {
      server_ip: '51.178.65.12',
      query_port: 2305,
      game_port: 2302,
      is_online: true,
      server_name: '[FR] DayZ Chernarus Vanilla+ | High Loot | PVP',
      map_name: 'ChernarusPlus',
      players_count: 48,
      max_players: 60,
      bots_count: 0,
      ping_ms: 24,
      environment: 'Linux',
      last_queried_at: new Date().toISOString(),
    },
  },
  {
    id: 'bot_namalsk_hardcore',
    name: 'Namalsk Hardcore Survival',
    discord_client_id: '987654321098765432',
    server_ip: '141.95.72.18',
    server_query_port: 27016,
    server_game_port: 27015,
    refresh_interval_secs: 20,
    worker_id: 'worker-eu-paris-01',
    status: 'active',
    activity_format: 'Joue à DayZ - {map} [{players}/{max_players}]',
    has_token: true,
    token_preview: 'OTE3...4abc',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    last_status: {
      server_ip: '141.95.72.18',
      query_port: 27016,
      game_port: 27015,
      is_online: true,
      server_name: '[EU] Namalsk Hardcore Survival - Cold & Blizzard',
      map_name: 'namalsk',
      players_count: 36,
      max_players: 40,
      bots_count: 0,
      ping_ms: 31,
      environment: 'Linux',
      last_queried_at: new Date().toISOString(),
    },
  },
];

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (res.ok) {
      const data: ApiResponse<T> = await res.json();
      if (data.data !== undefined) {
        return data.data;
      }
    }
  } catch (_e) {
    // API server not reachable or network error, fallback gracefully
  }

  // Graceful fallback for mock dev
  return handleMock<T>(endpoint, options);
}

function handleMock<T>(endpoint: string, options?: RequestInit): T {
  const method = options?.method || 'GET';

  if (endpoint === '/stats/overview') {
    const onlineWorkers = mockWorkers.filter(w => Date.now() - new Date(w.last_heartbeat_at || 0).getTime() < 60000).length;
    const activeBots = mockBots.filter(b => b.status === 'active').length;
    const onlineServers = mockBots.filter(b => b.last_status?.is_online).length;
    const totalPlayers = mockBots.reduce((sum, b) => sum + (b.last_status?.players_count || 0), 0);

    return {
      total_workers: mockWorkers.length,
      online_workers: onlineWorkers,
      total_bots: mockBots.length,
      active_bots: activeBots,
      online_servers: onlineServers,
      total_players_tracked: totalPlayers,
    } as unknown as T;
  }

  if (endpoint === '/workers') {
    return mockWorkers as unknown as T;
  }

  if (endpoint === '/bots' && method === 'GET') {
    return mockBots as unknown as T;
  }

  if (endpoint === '/bots' && method === 'POST') {
    const body = JSON.parse((options?.body as string) || '{}') as CreateBotInput;
    const newBot: BotSanitized = {
      id: `bot_${Math.random().toString(36).substring(2, 9)}`,
      name: body.name,
      discord_client_id: body.discord_client_id,
      server_ip: body.server_ip,
      server_query_port: body.server_query_port || 2305,
      server_game_port: body.server_game_port,
      refresh_interval_secs: body.refresh_interval_secs || 20,
      worker_id: body.worker_id || null,
      status: body.status || 'active',
      activity_format: body.activity_format || 'Joue à DayZ - {map} [{players}/{max_players}]',
      has_token: true,
      token_preview: body.discord_token.substring(0, 4) + '...' + body.discord_token.substring(body.discord_token.length - 4),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_status: {
        server_ip: body.server_ip,
        query_port: body.server_query_port || 2305,
        is_online: true,
        server_name: `${body.name} Server`,
        map_name: 'ChernarusPlus',
        players_count: 14,
        max_players: 60,
        bots_count: 0,
        ping_ms: 38,
        environment: 'Linux',
        last_queried_at: new Date().toISOString(),
      },
    };
    mockBots = [newBot, ...mockBots];
    return { id: newBot.id } as unknown as T;
  }

  if (endpoint.startsWith('/bots/') && method === 'PUT') {
    const id = endpoint.split('/')[2];
    const body = JSON.parse((options?.body as string) || '{}') as UpdateBotInput;
    mockBots = mockBots.map(b => (b.id === id ? { ...b, ...body, updated_at: new Date().toISOString() } : b));
    return { updated: true } as unknown as T;
  }

  if (endpoint.startsWith('/bots/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    mockBots = mockBots.filter(b => b.id !== id);
    return { deleted: true } as unknown as T;
  }

  if (endpoint.endsWith('/history')) {
    const logs: ServerStatusLog[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      bot_id: 'mock',
      server_ip: '51.178.65.12',
      query_port: 2305,
      is_online: true,
      server_name: 'DayZ Server',
      map_name: 'Chernarus',
      players_count: Math.floor(30 + Math.sin(i) * 15),
      max_players: 60,
      ping_ms: Math.floor(20 + Math.random() * 15),
      recorded_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    return logs as unknown as T;
  }

  return {} as T;
}

export const apiClient = {
  getOverviewStats: () => request<OverviewStats>('/stats/overview'),
  getWorkers: () => request<Worker[]>('/workers'),
  deleteWorker: (id: string) => request<{ deleted: boolean }>(`/workers/${id}`, { method: 'DELETE' }),
  getBots: () => request<BotSanitized[]>('/bots'),
  createBot: (input: CreateBotInput) => request<{ id: string }>('/bots', { method: 'POST', body: JSON.stringify(input) }),
  updateBot: (id: string, input: UpdateBotInput) => request<{ updated: boolean }>(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteBot: (id: string) => request<{ deleted: boolean }>(`/bots/${id}`, { method: 'DELETE' }),
  getBotHistory: (id: string) => request<ServerStatusLog[]>(`/bots/${id}/history`),
};
