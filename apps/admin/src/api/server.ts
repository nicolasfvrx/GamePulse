import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type {
  WorkerHeartbeatPayload,
  WorkerHeartbeatResponse,
  CreateBotInput,
  UpdateBotInput,
  CreateWorkerInput,
  CreateWorkerResponse,
  ApiResponse,
  OverviewStats,
  Worker,
  BotSanitized,
  ServerStatusLog,
  DayZServerStatus,
} from '@gamepulse/shared';

export type Env = {
  Bindings: {
    DB?: D1Database;
    WORKER_SECRET_KEY?: string;
    ADMIN_SECRET_KEY?: string;
  };
};

export const api = new Hono<Env>();

// Middleware CORS
api.use('*', cors());

// Admin Login endpoint
api.post('/auth/login', async (c) => {
  const body = await c.req.json<{ password?: string }>().catch(() => ({ password: '' }));
  const adminKey = c.env?.ADMIN_SECRET_KEY || 'gamepulse-admin-2026';
  if (body.password && body.password === adminKey) {
    return c.json<ApiResponse<{ token: string }>>({
      success: true,
      data: { token: adminKey },
      timestamp: new Date().toISOString(),
    });
  }
  return c.json<ApiResponse<null>>({
    success: false,
    error: 'Identifiants administrateur invalides',
    timestamp: new Date().toISOString(),
  }, 401);
});

// Admin Protection middleware for mutating routes (bots creation, edits, deletions, worker management)
const verifyAdminKey = async (c: any, next: any) => {
  if (['POST', 'PUT', 'DELETE'].includes(c.req.method)) {
    const adminKey = c.env?.ADMIN_SECRET_KEY || 'gamepulse-admin-2026';
    const clientKey = c.req.header('X-Admin-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (!clientKey || clientKey !== adminKey) {
      return c.json({
        success: false,
        error: 'Non autorisé: Clé administrateur requise',
        timestamp: new Date().toISOString(),
      }, 401);
    }
  }
  await next();
};

api.use('/bots', verifyAdminKey);
api.use('/bots/*', verifyAdminKey);
api.use('/workers', verifyAdminKey);
api.use('/workers/*', verifyAdminKey);

// Worker Authentication middleware for /worker/* routes
api.use('/worker/*', async (c, next) => {
  const defaultSecretKey = c.env?.WORKER_SECRET_KEY || 'gamepulse-worker-secret-token-change-in-prod';
  const clientKey = c.req.header('X-Worker-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!clientKey) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'Unauthorized: Missing X-Worker-Key header',
      timestamp: new Date().toISOString(),
    }, 401);
  }

  // Extract workerId from URL: /worker/:id/...
  const match = c.req.path.match(/\/worker\/([^/]+)/);
  const workerId = match ? match[1] : null;
  const db = c.env?.DB;

  if (workerId && db) {
    try {
      const row = await db.prepare('SELECT api_key FROM workers WHERE id = ?').bind(workerId).first<{ api_key?: string | null }>();
      if (row && row.api_key) {
        if (row.api_key === 'revoked') {
          return c.json<ApiResponse<null>>({
            success: false,
            error: 'Unauthorized: Worker API key has been revoked',
            timestamp: new Date().toISOString(),
          }, 403);
        }
        if (row.api_key === clientKey) {
          return await next();
        }
        return c.json<ApiResponse<null>>({
          success: false,
          error: 'Unauthorized: Invalid worker API key',
          timestamp: new Date().toISOString(),
        }, 401);
      }
    } catch (err) {
      console.warn('Erreur vérification worker api_key en base:', err);
    }
  }

  // Fallback to global secret key if no specific key exists for worker yet
  if (clientKey === defaultSecretKey) {
    return await next();
  }

  return c.json<ApiResponse<null>>({
    success: false,
    error: 'Unauthorized: Invalid worker secret key',
    timestamp: new Date().toISOString(),
  }, 401);
});

// -------------------------------------------------------------
// WORKER ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/worker/:id/bots
 * Returns all active bots assigned to this worker or set to auto-assignment.
 */
api.get('/worker/:id/bots', async (c) => {
  const workerId = c.req.param('id');
  const db = c.env?.DB;

  if (!db) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'D1 Database not configured',
      timestamp: new Date().toISOString(),
    }, 500);
  }

  try {
    const { results } = await db.prepare(
      `SELECT * FROM bots
       WHERE status = 'active'
         AND (worker_id = ? OR worker_id IS NULL OR worker_id = '' OR worker_id = 'auto')
       ORDER BY created_at ASC`
    ).bind(workerId).all();

    return c.json({
      success: true,
      data: results ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to fetch worker bots: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/worker/:id/heartbeat
 * Worker heartbeats with CPU/RAM metrics and DayZ server query statuses.
 */
api.post('/worker/:id/heartbeat', async (c) => {
  const workerId = c.req.param('id');
  const db = c.env?.DB;

  if (!db) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'D1 Database not configured',
      timestamp: new Date().toISOString(),
    }, 500);
  }

  try {
    const payload = await c.req.json<WorkerHeartbeatPayload>();
    const nowIso = new Date().toISOString();
    const hostname = payload.hostname || 'worker-host';
    const version = payload.version || '1.0.0';
    const metrics = payload.metrics || {
      cpu_usage_percent: 0,
      ram_used_mb: 0,
      ram_total_mb: 0,
      uptime_seconds: 0,
    };
    const activeBotsCount = payload.active_bot_ids ? payload.active_bot_ids.length : 0;

    // 1. Upsert worker record
    await db.prepare(
      `INSERT INTO workers (
        id, name, hostname, version, status,
        cpu_usage_percent, ram_used_mb, ram_total_mb,
        uptime_seconds, active_bots_count, last_heartbeat_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hostname = excluded.hostname,
        version = excluded.version,
        status = 'online',
        cpu_usage_percent = excluded.cpu_usage_percent,
        ram_used_mb = excluded.ram_used_mb,
        ram_total_mb = excluded.ram_total_mb,
        uptime_seconds = excluded.uptime_seconds,
        active_bots_count = excluded.active_bots_count,
        last_heartbeat_at = excluded.last_heartbeat_at,
        updated_at = excluded.updated_at`
    ).bind(
      workerId,
      workerId,
      hostname,
      version,
      metrics.cpu_usage_percent,
      metrics.ram_used_mb,
      metrics.ram_total_mb,
      metrics.uptime_seconds,
      activeBotsCount,
      nowIso,
      nowIso,
      nowIso
    ).run();

    // 2. Process server statuses reported by worker
    if (payload.server_statuses && typeof payload.server_statuses === 'object') {
      const updates = [];
      const logInserts = [];

      for (const [botId, statusObj] of Object.entries(payload.server_statuses)) {
        if (!statusObj) continue;
        const status = statusObj as DayZServerStatus;

        updates.push(
          db.prepare(
            `UPDATE bots SET
              last_server_name = ?,
              last_map_name = ?,
              last_players_count = ?,
              last_max_players = ?,
              last_ping_ms = ?,
              last_is_online = ?,
              last_error = ?,
              last_queried_at = ?,
              updated_at = ?
            WHERE id = ?`
          ).bind(
            status.server_name || '',
            status.map_name || '',
            status.players_count ?? 0,
            status.max_players ?? 60,
            status.ping_ms ?? 0,
            status.is_online ? 1 : 0,
            status.error || null,
            status.last_queried_at || nowIso,
            nowIso,
            botId
          )
        );

        logInserts.push(
          db.prepare(
            `INSERT INTO server_status_logs (
              bot_id, server_ip, query_port, is_online,
              server_name, map_name, players_count, max_players,
              ping_ms, error, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            botId,
            status.server_ip || '',
            status.query_port || 2305,
            status.is_online ? 1 : 0,
            status.server_name || '',
            status.map_name || '',
            status.players_count ?? 0,
            status.max_players ?? 60,
            status.ping_ms ?? 0,
            status.error || null,
            nowIso
          )
        );
      }

      if (updates.length > 0) {
        await db.batch([...updates, ...logInserts]);
      }
    }

    // 3. Count assigned bots
    const countRow = await db.prepare(
      `SELECT COUNT(*) as count FROM bots
       WHERE status = 'active'
         AND (worker_id = ? OR worker_id IS NULL OR worker_id = '' OR worker_id = 'auto')`
    ).bind(workerId).first<{ count: number }>();

    return c.json<ApiResponse<WorkerHeartbeatResponse>>({
      success: true,
      data: {
        success: true,
        acknowledged_at: nowIso,
        assigned_bots_count: countRow?.count ?? 0,
      },
      timestamp: nowIso,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Heartbeat failed: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// -------------------------------------------------------------
// ADMIN MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/stats/overview
 */
api.get('/stats/overview', async (c) => {
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<OverviewStats>>({
      success: true,
      data: {
        total_workers: 0,
        online_workers: 0,
        total_bots: 0,
        active_bots: 0,
        online_servers: 0,
        total_players_tracked: 0,
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const [workersData, botsData] = await Promise.all([
      db.prepare(`
        SELECT
          COUNT(*) as total_workers,
          SUM(CASE WHEN datetime(last_heartbeat_at) >= datetime('now', '-60 seconds') THEN 1 ELSE 0 END) as online_workers
        FROM workers
      `).first<{ total_workers: number; online_workers: number }>(),
      db.prepare(`
        SELECT
          COUNT(*) as total_bots,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_bots,
          SUM(CASE WHEN last_is_online = 1 THEN 1 ELSE 0 END) as online_servers,
          SUM(CASE WHEN last_is_online = 1 THEN last_players_count ELSE 0 END) as total_players_tracked
        FROM bots
      `).first<{
        total_bots: number;
        active_bots: number;
        online_servers: number;
        total_players_tracked: number;
      }>()
    ]);

    const overview: OverviewStats = {
      total_workers: workersData?.total_workers ?? 0,
      online_workers: workersData?.online_workers ?? 0,
      total_bots: botsData?.total_bots ?? 0,
      active_bots: botsData?.active_bots ?? 0,
      online_servers: botsData?.online_servers ?? 0,
      total_players_tracked: botsData?.total_players_tracked ?? 0,
    };

    return c.json<ApiResponse<OverviewStats>>({
      success: true,
      data: overview,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to fetch stats overview: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/workers
 */
api.get('/workers', async (c) => {
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<Worker[]>>({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { results } = await db.prepare(
      `SELECT
        id, name, hostname, version,
        CASE
          WHEN api_key = 'revoked' THEN 'offline'
          WHEN datetime(last_heartbeat_at) >= datetime('now', '-60 seconds') THEN 'online'
          WHEN datetime(last_heartbeat_at) >= datetime('now', '-180 seconds') THEN 'degraded'
          ELSE 'offline'
        END as status,
        cpu_usage_percent, ram_used_mb, ram_total_mb,
        uptime_seconds, active_bots_count, last_heartbeat_at,
        api_key,
        CASE
          WHEN api_key IS NOT NULL AND length(api_key) > 10 THEN substr(api_key, 1, 8) || '...' || substr(api_key, -4)
          ELSE api_key
        END as api_key_preview,
        created_at, updated_at
       FROM workers
       ORDER BY last_heartbeat_at DESC`
    ).all<Worker>();

    return c.json<ApiResponse<Worker[]>>({
      success: true,
      data: results ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to fetch workers: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/workers
 * Registers a new worker and generates a dedicated secret API key
 */
api.post('/workers', async (c) => {
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  const body = await c.req.json<CreateWorkerInput>().catch(() => ({} as CreateWorkerInput));
  if (!body.id?.trim() || !body.name?.trim()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'Identifiant (ID) et Nom du worker sont obligatoires',
      timestamp: new Date().toISOString(),
    }, 400);
  }

  const workerId = body.id.trim();
  const workerName = body.name.trim();
  const apiKey = body.api_key?.trim() || `gp_wrk_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO workers (
        id, name, hostname, version, status, api_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'offline', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        api_key = excluded.api_key,
        updated_at = excluded.updated_at
    `).bind(
      workerId,
      workerName,
      body.hostname?.trim() || 'worker-host',
      body.version?.trim() || '1.0.0',
      apiKey,
      now,
      now
    ).run();

    const createdWorker: Worker = {
      id: workerId,
      name: workerName,
      hostname: body.hostname?.trim() || 'worker-host',
      version: body.version?.trim() || '1.0.0',
      status: 'offline',
      cpu_usage_percent: 0,
      ram_used_mb: 0,
      ram_total_mb: 0,
      uptime_seconds: 0,
      active_bots_count: 0,
      api_key: apiKey,
      api_key_preview: apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4),
      last_heartbeat_at: null,
      created_at: now,
      updated_at: now,
    };

    return c.json<ApiResponse<CreateWorkerResponse>>({
      success: true,
      data: {
        worker: createdWorker,
        api_key: apiKey,
      },
      timestamp: now,
    }, 201);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to create worker: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/workers/:id/regenerate-key
 * Regenerates a dedicated API key for a worker
 */
api.post('/workers/:id/regenerate-key', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  const newKey = `gp_wrk_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      UPDATE workers
      SET api_key = ?, updated_at = ?
      WHERE id = ?
    `).bind(newKey, now, id).run();

    return c.json<ApiResponse<{ api_key: string }>>({
      success: true,
      data: { api_key: newKey },
      timestamp: now,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to regenerate worker key: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/workers/:id/revoke-key
 * Revokes the worker API key, blocking connection
 */
api.post('/workers/:id/revoke-key', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  const now = new Date().toISOString();

  try {
    await db.prepare(`
      UPDATE workers
      SET api_key = 'revoked', status = 'offline', updated_at = ?
      WHERE id = ?
    `).bind(now, id).run();

    return c.json<ApiResponse<{ revoked: boolean }>>({
      success: true,
      data: { revoked: true },
      timestamp: now,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to revoke worker key: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * DELETE /api/workers/:id
 */
api.delete('/workers/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  await db.prepare('DELETE FROM workers WHERE id = ?').bind(id).run();
  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/bots
 */
api.get('/bots', async (c) => {
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<BotSanitized[]>>({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { results } = await db.prepare(
      `SELECT
        id, name, discord_client_id, server_ip, server_query_port,
        server_game_port, refresh_interval_secs, worker_id, status,
        activity_format, created_at, updated_at,
        last_server_name, last_map_name, last_players_count,
        last_max_players, last_ping_ms, last_is_online,
        last_error, last_queried_at,
        substr(discord_token, 1, 4) || '...' || substr(discord_token, -4) as token_preview
       FROM bots
       ORDER BY created_at DESC`
    ).all();

    const sanitized: BotSanitized[] = (results ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      discord_client_id: row.discord_client_id,
      server_ip: row.server_ip,
      server_query_port: row.server_query_port,
      server_game_port: row.server_game_port,
      refresh_interval_secs: row.refresh_interval_secs,
      worker_id: row.worker_id,
      status: row.status,
      activity_format: row.activity_format,
      created_at: row.created_at,
      updated_at: row.updated_at,
      has_token: true,
      token_preview: row.token_preview,
      last_status: row.last_queried_at ? {
        server_ip: row.server_ip,
        query_port: row.server_query_port,
        game_port: row.server_game_port,
        is_online: Boolean(row.last_is_online),
        server_name: row.last_server_name || '',
        map_name: row.last_map_name || '',
        players_count: row.last_players_count ?? 0,
        max_players: row.last_max_players ?? 60,
        bots_count: 0,
        ping_ms: row.last_ping_ms ?? 0,
        environment: 'Linux',
        last_queried_at: row.last_queried_at,
        error: row.last_error,
      } : null,
    }));

    return c.json<ApiResponse<BotSanitized[]>>({
      success: true,
      data: sanitized,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to fetch bots: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/bots
 */
api.post('/bots', async (c) => {
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  try {
    const body = await c.req.json<CreateBotInput>();
    if (!body.name || !body.discord_token || !body.discord_client_id || !body.server_ip) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: 'Missing required fields: name, discord_token, discord_client_id, server_ip',
        timestamp: new Date().toISOString(),
      }, 400);
    }

    const id = `bot_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    await db.prepare(
      `INSERT INTO bots (
        id, name, discord_token, discord_client_id,
        server_ip, server_query_port, server_game_port,
        refresh_interval_secs, worker_id, status,
        activity_format, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.name,
      body.discord_token,
      body.discord_client_id,
      body.server_ip,
      body.server_query_port ?? 2305,
      body.server_game_port ?? null,
      body.refresh_interval_secs ?? 20,
      body.worker_id || null,
      body.status ?? 'active',
      body.activity_format ?? 'Joue à DayZ - {map} [{players}/{max_players}]',
      nowIso,
      nowIso
    ).run();

    return c.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
      timestamp: nowIso,
    }, 201);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to create bot: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * PUT /api/bots/:id
 */
api.put('/api/bots/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  try {
    const body = await c.req.json<UpdateBotInput>();
    const nowIso = new Date().toISOString();

    // Check if token was provided or left unchanged
    if (body.discord_token && body.discord_token.trim().length > 0) {
      await db.prepare(
        `UPDATE bots SET
          name = COALESCE(?, name),
          discord_token = ?,
          discord_client_id = COALESCE(?, discord_client_id),
          server_ip = COALESCE(?, server_ip),
          server_query_port = COALESCE(?, server_query_port),
          server_game_port = COALESCE(?, server_game_port),
          refresh_interval_secs = COALESCE(?, refresh_interval_secs),
          worker_id = ?,
          status = COALESCE(?, status),
          activity_format = COALESCE(?, activity_format),
          updated_at = ?
        WHERE id = ?`
      ).bind(
        body.name ?? null,
        body.discord_token,
        body.discord_client_id ?? null,
        body.server_ip ?? null,
        body.server_query_port ?? null,
        body.server_game_port ?? null,
        body.refresh_interval_secs ?? null,
        body.worker_id || null,
        body.status ?? null,
        body.activity_format ?? null,
        nowIso,
        id
      ).run();
    } else {
      await db.prepare(
        `UPDATE bots SET
          name = COALESCE(?, name),
          discord_client_id = COALESCE(?, discord_client_id),
          server_ip = COALESCE(?, server_ip),
          server_query_port = COALESCE(?, server_query_port),
          server_game_port = COALESCE(?, server_game_port),
          refresh_interval_secs = COALESCE(?, refresh_interval_secs),
          worker_id = ?,
          status = COALESCE(?, status),
          activity_format = COALESCE(?, activity_format),
          updated_at = ?
        WHERE id = ?`
      ).bind(
        body.name ?? null,
        body.discord_client_id ?? null,
        body.server_ip ?? null,
        body.server_query_port ?? null,
        body.server_game_port ?? null,
        body.refresh_interval_secs ?? null,
        body.worker_id || null,
        body.status ?? null,
        body.activity_format ?? null,
        nowIso,
        id
      ).run();
    }

    return c.json<ApiResponse<{ updated: boolean }>>({
      success: true,
      data: { updated: true },
      timestamp: nowIso,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to update bot: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * DELETE /api/bots/:id
 */
api.delete('/bots/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<null>>({ success: false, error: 'DB not available', timestamp: new Date().toISOString() }, 500);
  }

  await db.prepare('DELETE FROM bots WHERE id = ?').bind(id).run();
  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/bots/:id/history
 */
api.get('/bots/:id/history', async (c) => {
  const id = c.req.param('id');
  const db = c.env?.DB;
  if (!db) {
    return c.json<ApiResponse<ServerStatusLog[]>>({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { results } = await db.prepare(
      `SELECT * FROM server_status_logs
       WHERE bot_id = ?
       ORDER BY recorded_at DESC
       LIMIT 50`
    ).bind(id).all<ServerStatusLog>();

    return c.json<ApiResponse<ServerStatusLog[]>>({
      success: true,
      data: results ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse<null>>({
      success: false,
      error: `Failed to fetch bot history: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});
