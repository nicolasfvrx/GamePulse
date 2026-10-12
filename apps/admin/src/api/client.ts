import type {
  ApiResponse,
  OverviewStats,
  Worker,
  CreateWorkerInput,
  CreateWorkerResponse,
  BotSanitized,
  CreateBotInput,
  UpdateBotInput,
  ServerStatusLog,
} from '@gamepulse/shared';

const API_BASE = '/api';
const TOKEN_STORAGE_KEY = 'gamepulse_admin_token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Key': token } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorJson?.error || `HTTP error ${res.status}`);
  }

  const json: ApiResponse<T> = await res.json();
  if (json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
}

export const apiClient = {
  login: async (password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const json: ApiResponse<{ token: string }> = await res.json();
        if (json.data?.token) {
          setAdminToken(json.data.token);
          return true;
        }
      }
    } catch (err) {
      console.error('Erreur login:', err);
    }
    return false;
  },

  logout: () => {
    clearAdminToken();
  },

  isAuthenticated: () => {
    return Boolean(getAdminToken());
  },

  getOverviewStats: async (): Promise<OverviewStats> => {
    try {
      return await request<OverviewStats>('/stats/overview');
    } catch {
      return {
        total_workers: 0,
        online_workers: 0,
        total_bots: 0,
        active_bots: 0,
        online_servers: 0,
        total_players_tracked: 0,
      };
    }
  },

  getWorkers: async (): Promise<Worker[]> => {
    try {
      const data = await request<Worker[]>('/workers');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  createWorker: (input: CreateWorkerInput) =>
    request<CreateWorkerResponse>('/workers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  regenerateWorkerKey: (id: string) =>
    request<{ api_key: string }>(`/workers/${id}/regenerate-key`, {
      method: 'POST',
    }),

  revokeWorkerKey: (id: string) =>
    request<{ revoked: boolean }>(`/workers/${id}/revoke-key`, {
      method: 'POST',
    }),

  deleteWorker: (id: string) =>
    request<{ deleted: boolean }>(`/workers/${id}`, { method: 'DELETE' }),

  getBots: async (): Promise<BotSanitized[]> => {
    try {
      const data = await request<BotSanitized[]>('/bots');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  createBot: (input: CreateBotInput) =>
    request<{ id: string }>('/bots', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateBot: (id: string, input: UpdateBotInput) =>
    request<{ updated: boolean }>(`/bots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteBot: (id: string) =>
    request<{ deleted: boolean }>(`/bots/${id}`, { method: 'DELETE' }),

  getBotHistory: async (id: string): Promise<ServerStatusLog[]> => {
    try {
      const data = await request<ServerStatusLog[]>(`/bots/${id}/history`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
};
