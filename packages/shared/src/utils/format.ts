import type { DayZServerStatus } from '../types/server.js';

/**
 * Formats a Discord presence activity string using server status data and a template.
 * Template placeholders:
 * {server_name} - Full name of the server
 * {map} - Map name (e.g. Chernarus, Livonia, Namalsk)
 * {players} - Current online players
 * {max_players} - Maximum server capacity
 * {queue} - Estimated queue or 0
 * {ping} - Query ping in ms
 */
export function formatPresenceText(
  template: string = 'Joue à DayZ - {map} [{players}/{max_players}]',
  status?: DayZServerStatus | null
): string {
  if (!status || !status.is_online) {
    return 'DayZ - Serveur Hors Ligne';
  }

  return template
    .replace('{server_name}', status.server_name || 'DayZ Server')
    .replace('{map}', status.map_name || 'Chernarus')
    .replace('{players}', String(status.players_count ?? 0))
    .replace('{max_players}', String(status.max_players ?? 60))
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
