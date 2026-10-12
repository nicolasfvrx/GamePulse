import type { DayZServerStatus } from '../types/server.js';

export const DEFAULT_MAP_NAMES: Record<string, string> = {
  'chernarusplus': 'Chernarus',
  'chernarus': 'Chernarus',
  'enoch': 'Livonia',
  'namalsk': 'Namalsk',
  'takistanplus': 'Takistan+',
  'takistan': 'Takistan',
  'deerisle': 'Deer Isle',
  'rostow': 'Rostow',
  'esseker': 'Esseker',
  'valning': 'Välning',
  'banov': 'Banov',
  'pripyat': 'Pripyat',
  'chiemsee': 'Chiemsee',
  'melkart': 'Melkart',
  'arland': 'Arland',
  'everon': 'Everon',
  'sakhal': 'Sakhal',
  'anizay': 'Anizay',
  'barrington': 'Barrington',
  'iztek': 'Iztek',
  'alteria': 'Alteria',
  'archana': 'Archana',
};

export function cleanDefaultMapName(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'Chernarus';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (DEFAULT_MAP_NAMES[lower]) {
    return DEFAULT_MAP_NAMES[lower];
  }
  // Title-case fallback: takistan -> Takistan
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function resolveMapName(raw?: string | null, dictionary?: Record<string, string> | null): string {
  if (!raw || !raw.trim()) return 'Chernarus';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (dictionary && dictionary[lower]) {
    return dictionary[lower];
  }
  return cleanDefaultMapName(trimmed);
}

/**
 * Formats a Discord presence activity string using server status data and a template.
 * Template placeholders:
 * {server_name} - Full name of the server
 * {map} - Map name (e.g. Chernarus, Livonia, Namalsk)
 * {players} - Current online players
 * {max_players} - Maximum server capacity
 * {queue} - Estimated queue or 0
 * {queue_suffix} - Formatted suffix (e.g. " (+5)") if queue > 0, otherwise empty
 * {ping} - Query ping in ms
 */
export function formatPresenceText(
  template: string = 'Joue à DayZ - {map} [{players}/{max_players}]',
  status?: DayZServerStatus | null,
  customStatus?: { enabled?: boolean; text?: string | null },
  mapDictionary?: Record<string, string> | null
): string {
  const mapName = resolveMapName(status?.map_name, mapDictionary);

  if (customStatus?.enabled && customStatus.text && customStatus.text.trim()) {
    const custom = customStatus.text.trim();
    if (status && status.is_online) {
      const queue = status.queue_size ?? 0;
      const queueSuffix = queue > 0 ? ` (+${queue})` : '';
      return custom
        .replace('{server_name}', status.server_name || 'DayZ Server')
        .replace('{map}', mapName)
        .replace('{players}', String(status.players_count ?? 0))
        .replace('{max_players}', String(status.max_players ?? 60))
        .replace('{queue}', String(queue))
        .replace('{queue_suffix}', queueSuffix)
        .replace('{ping}', `${status.ping_ms ?? 0}ms`);
    }
    return custom;
  }

  if (!status || !status.is_online) {
    return 'DayZ - Serveur Hors Ligne';
  }

  const queue = status.queue_size ?? 0;
  const queueSuffix = queue > 0 ? ` (+${queue})` : '';

  return template
    .replace('{server_name}', status.server_name || 'DayZ Server')
    .replace('{map}', mapName)
    .replace('{players}', String(status.players_count ?? 0))
    .replace('{max_players}', String(status.max_players ?? 60))
    .replace('{queue}', String(queue))
    .replace('{queue_suffix}', queueSuffix)
    .replace('{ping}', `${status.ping_ms ?? 0}ms`);
}

/**
 * Formats seconds into a human-readable duration (e.g. "3j 5h 12m" or "45m 10s").
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);

  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

/**
 * Determines whether a worker is considered online given its last heartbeat timestamp.
 * Defaults to 60 seconds tolerance.
 */
export function isWorkerOnline(lastHeartbeat: string | null | undefined, timeoutSeconds = 60): boolean {
  if (!lastHeartbeat) return false;
  const last = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  return now - last < timeoutSeconds * 1000;
}
