use crate::a2s::DayZServerStatus;
use anyhow::{anyhow, Context, Result};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info};

const CFTOOLS_API_BASE: &str = "https://data.cftools.cloud/v1";

#[derive(Serialize)]
struct AuthRegisterPayload<'a> {
    application_id: &'a str,
    secret: &'a str,
}

#[derive(Deserialize)]
struct AuthRegisterResponse {
    token: Option<String>,
}

#[derive(Clone)]
pub struct CFToolsClient {
    http: Client,
    application_id: Arc<RwLock<Option<String>>>,
    secret: Arc<RwLock<Option<String>>>,
    cached_token: Arc<RwLock<Option<(String, Instant)>>>,
}

impl CFToolsClient {
    pub fn new(application_id: Option<String>, secret: Option<String>) -> Self {
        let user_agent = format!("GamePulse/{} (Discord Presence Bot)", env!("CARGO_PKG_VERSION"));
        let mut default_headers = header::HeaderMap::new();
        default_headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/json"));

        let http = Client::builder()
            .timeout(Duration::from_secs(8))
            .user_agent(user_agent)
            .default_headers(default_headers)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            http,
            application_id: Arc::new(RwLock::new(application_id)),
            secret: Arc::new(RwLock::new(secret)),
            cached_token: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn update_credentials(&self, new_app_id: Option<String>, new_secret: Option<String>) {
        let mut app_lock = self.application_id.write().await;
        let mut sec_lock = self.secret.write().await;

        let changed = *app_lock != new_app_id || (new_secret.is_some() && *sec_lock != new_secret);
        if changed {
            info!("CFTools Cloud credentials updated in worker");
            *app_lock = new_app_id;
            if new_secret.is_some() {
                *sec_lock = new_secret;
            }
            let mut tok_lock = self.cached_token.write().await;
            *tok_lock = None;
        }
    }

    pub async fn has_credentials(&self) -> bool {
        let app = self.application_id.read().await;
        let sec = self.secret.read().await;
        matches!((&*app, &*sec), (Some(a), Some(s)) if !a.is_empty() && !s.is_empty())
    }

    async fn get_token(&self) -> Result<String> {
        // 1. Check existing cached token
        {
            let lock = self.cached_token.read().await;
            if let Some((token, instant)) = &*lock {
                // Tokens are valid 24h, expire in cache after 20 hours
                if instant.elapsed() < Duration::from_secs(20 * 3600) {
                    return Ok(token.clone());
                }
            }
        }

        // 2. Obtain credentials
        let (app_id, secret) = {
            let app = self.application_id.read().await;
            let sec = self.secret.read().await;
            match (&*app, &*sec) {
                (Some(a), Some(s)) if !a.is_empty() && !s.is_empty() => (a.clone(), s.clone()),
                _ => return Err(anyhow!("CFTools Application ID or Secret missing")),
            }
        };

        // 3. Request fresh token from CFTools Data API
        let mut tok_lock = self.cached_token.write().await;
        // Double check cache in write lock
        if let Some((token, instant)) = &*tok_lock {
            if instant.elapsed() < Duration::from_secs(20 * 3600) {
                return Ok(token.clone());
            }
        }

        debug!("Requesting new token from CFTools auth/register...");
        let payload = AuthRegisterPayload {
            application_id: &app_id,
            secret: &secret,
        };

        let res = self
            .http
            .post(format!("{}/auth/register", CFTOOLS_API_BASE))
            .json(&payload)
            .send()
            .await
            .context("Failed to connect to CFTools auth/register")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(anyhow!("CFTools auth failed ({status}): {body}"));
        }

        let auth_resp: AuthRegisterResponse = res
            .json()
            .await
            .context("Failed to parse CFTools auth response")?;

        let token = auth_resp
            .token
            .ok_or_else(|| anyhow!("CFTools response did not contain token"))?;

        *tok_lock = Some((token.clone(), Instant::now()));
        info!("Successfully obtained new CFTools Cloud Bearer token");
        Ok(token)
    }

    pub async fn query_server(
        &self,
        server_id: Option<&str>,
        server_ip: &str,
        query_port: u16,
        game_port: Option<u16>,
    ) -> Result<DayZServerStatus> {
        let token = self.get_token().await?;
        let clean_id = server_id.map(|s| s.trim()).filter(|s| !s.is_empty());

        let start_time = Instant::now();

        // 1. If server_id looks like a Server API ID (UUID: contains '-' and length around 36)
        // try to fetch server info from /v1/server/{server_id}/info to discover the gameserver_id
        let mut discovered_gameserver_id: Option<String> = None;
        if let Some(id) = clean_id {
            if id.contains('-') && id.len() >= 32 {
                debug!("Server ID '{id}' looks like a Server API ID. Querying /v1/server/{id}/info...");
                let info_url = format!("{}/server/{}/info", CFTOOLS_API_BASE, id);
                let info_res = self
                    .http
                    .get(&info_url)
                    .header(header::AUTHORIZATION, format!("Bearer {token}"))
                    .send()
                    .await;

                match info_res {
                    Ok(res) if res.status().is_success() => {
                        if let Ok(info_json) = res.json::<serde_json::Value>().await {
                            if let Some(gs_id) = info_json
                                .get("server")
                                .and_then(|s| s.get("gameserver"))
                                .and_then(|g| g.get("gameserver_id"))
                                .and_then(|v| v.as_str())
                            {
                                debug!("Resolved gameserver_id '{gs_id}' from Server API ID '{id}'");
                                discovered_gameserver_id = Some(gs_id.to_string());
                            }
                        }
                    }
                    Ok(res) => {
                        let status = res.status();
                        if status == reqwest::StatusCode::UNAUTHORIZED {
                            let mut tok_lock = self.cached_token.write().await;
                            *tok_lock = None;
                        }
                        let body = res.text().await.unwrap_or_default();
                        debug!("CFTools /v1/server/{id}/info returned ({status}): {body}. Will attempt direct resource lookup.");
                    }
                    Err(err) => {
                        debug!("Failed to query /v1/server/{id}/info: {err}");
                    }
                }
            }
        }

        // 2. Build list of candidate gameserver resource IDs to query
        let mut candidates: Vec<String> = Vec::new();

        if let Some(gs_id) = discovered_gameserver_id {
            candidates.push(gs_id);
        }

        if let Some(id) = clean_id {
            // If it's a 40-char hex string (SHA-1 hash), add it
            if id.len() == 40 && id.chars().all(|c| c.is_ascii_hexdigit()) && !candidates.contains(&id.to_string()) {
                candidates.push(id.to_string());
            }
        }

        // Generate SHA-1 candidates from IP (and resolved DNS if domain) and candidate ports
        let mut candidate_ports: Vec<u16> = Vec::new();
        if let Some(gp) = game_port {
            candidate_ports.push(gp);
        }
        if query_port > 1 && !candidate_ports.contains(&(query_port - 1)) {
            candidate_ports.push(query_port - 1);
        }
        if !candidate_ports.contains(&2302) {
            candidate_ports.push(2302);
        }
        if !candidate_ports.contains(&query_port) {
            candidate_ports.push(query_port);
        }

        let clean_ip = server_ip.trim();
        let mut ips: Vec<String> = vec![clean_ip.to_string()];
        // If domain name, also try resolved numeric IP address
        if clean_ip.chars().any(|c| c.is_alphabetic()) {
            if let Ok(mut addrs) = tokio::net::lookup_host(format!("{}:{}", clean_ip, query_port)).await {
                if let Some(resolved) = addrs.next() {
                    let resolved_ip = resolved.ip().to_string();
                    if !ips.contains(&resolved_ip) {
                        ips.push(resolved_ip);
                    }
                }
            }
        }

        for ip in &ips {
            for &port in &candidate_ports {
                let hash = compute_cftools_resource_id("1", ip, port);
                if !candidates.contains(&hash) {
                    candidates.push(hash);
                }
            }
        }

        // 3. Try each candidate on /v1/gameserver/{resource_id}
        let mut last_err = String::new();
        let mut first_offline_status: Option<DayZServerStatus> = None;

        for resource_id in &candidates {
            let url = format!("{}/gameserver/{}", CFTOOLS_API_BASE, resource_id);
            let res = match self
                .http
                .get(&url)
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
            {
                Ok(r) => r,
                Err(err) => {
                    last_err = format!("Network error: {err}");
                    continue;
                }
            };

            if !res.status().is_success() {
                let status = res.status();
                if status == reqwest::StatusCode::UNAUTHORIZED {
                    let mut tok_lock = self.cached_token.write().await;
                    *tok_lock = None;
                }
                let body = res.text().await.unwrap_or_default();
                last_err = format!("CFTools query HTTP {status}: {body}");
                continue;
            }

            let json: serde_json::Value = match res.json().await {
                Ok(j) => j,
                Err(err) => {
                    last_err = format!("JSON parse error: {err}");
                    continue;
                }
            };

            // If CFTools returns {"status": false}, this candidate was not found!
            if json.get("status").and_then(|v| v.as_bool()) == Some(false) {
                last_err = format!("Server not found on CFTools for {resource_id} (status: false)");
                continue;
            }

            // In CFTools response, the root object has keys matching the resource_id
            let server_obj = if let Some(obj) = json.get(resource_id).filter(|o| o.is_object()) {
                obj
            } else if let Some(map) = json.as_object() {
                if let Some(found) = map.values().find(|v| {
                    v.is_object() && (
                        v.get("status").is_some_and(|s| s.is_object()) ||
                        v.get("name").is_some_and(|n| n.is_string())
                    )
                }) {
                    found
                } else {
                    last_err = format!("No server details object found in CFTools response for {resource_id}");
                    continue;
                }
            } else {
                last_err = format!("Invalid response format for {resource_id}");
                continue;
            };

            let ping_ms = start_time.elapsed().as_millis() as u64;

            let parsed_status = match parse_cftools_server_details(server_obj, server_ip, query_port, game_port, ping_ms) {
                Some(s) => s,
                None => {
                    last_err = format!("Response for {resource_id} missing valid server details or error reported");
                    continue;
                }
            };

            if parsed_status.is_online {
                debug!(
                    "CFTools candidate {} is ONLINE: players={}/{}, queue={:?}, map={}",
                    resource_id, parsed_status.players_count, parsed_status.max_players, parsed_status.queue_size, parsed_status.map_name
                );
                return Ok(parsed_status);
            } else {
                debug!(
                    "CFTools candidate {} responded with OFFLINE status (online={:?}, offline={:?}, status={:?}, players={}). Checking other candidates...",
                    resource_id,
                    server_obj.get("online"),
                    server_obj.get("offline"),
                    server_obj.get("status"),
                    parsed_status.players_count
                );
                if first_offline_status.is_none() {
                    first_offline_status = Some(parsed_status);
                }
            }
        }

        if let Some(offline_status) = first_offline_status {
            return Ok(offline_status);
        }

        Err(anyhow!(
            "CFTools query failed for server {:?} ({}:{}): {} (tried {} candidates: {:?})",
            clean_id,
            server_ip,
            query_port,
            last_err,
            candidates.len(),
            candidates
        ))
    }
}

/// Parses a CFTools server details JSON object into a DayZServerStatus.
/// Robustly handles online/offline flags, player counts, queue sizes, and edge cases.
pub fn parse_cftools_server_details(
    server_obj: &serde_json::Value,
    server_ip: &str,
    query_port: u16,
    game_port: Option<u16>,
    ping_ms: u64,
) -> Option<DayZServerStatus> {
    let status_obj = server_obj.get("status").and_then(|s| s.as_object());
    let name_str = server_obj.get("name").and_then(|n| n.as_str());
    if status_obj.is_none() && name_str.is_none() {
        return None;
    }

    if let Some(err_val) = server_obj.get("_object").and_then(|o| o.get("error")).and_then(|e| e.as_str()) {
        if err_val != "GameServerQueryError.NONE" {
            return None;
        }
    }

    let server_name = name_str.unwrap_or("DayZ Server").to_string();

    let map_name = server_obj
        .get("map")
        .and_then(|v| v.as_str())
        .unwrap_or("Chernarus")
        .to_string();

    let version = server_obj
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let players_count = status_obj
        .and_then(|s| s.get("players"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u8;

    let max_players = status_obj
        .and_then(|s| s.get("slots"))
        .and_then(|v| v.as_u64())
        .unwrap_or(60) as u8;

    let queue_size = status_obj
        .and_then(|s| s.get("queue"))
        .and_then(|q| q.get("size"))
        .and_then(|v| v.as_u64())
        .map(|q| q as u32);

    let is_online = if players_count > 0 {
        // If there are players actively playing on the server, it is 100% online regardless of lag in crawler
        true
    } else {
        let online_val = server_obj.get("online").and_then(|v| {
            v.as_bool()
                .or_else(|| v.as_str().map(|s| s.eq_ignore_ascii_case("true") || s == "1" || s.eq_ignore_ascii_case("online")))
                .or_else(|| v.as_i64().map(|n| n != 0))
        });
        let offline_val = server_obj.get("offline").and_then(|v| {
            v.as_bool()
                .or_else(|| v.as_str().map(|s| s.eq_ignore_ascii_case("true") || s == "1" || s.eq_ignore_ascii_case("offline")))
                .or_else(|| v.as_i64().map(|n| n != 0))
        });
        let status_str_online = server_obj.get("status").and_then(|v| v.as_str()).map(|s| {
            s.eq_ignore_ascii_case("online")
        });

        online_val
            .or_else(|| offline_val.map(|off| !off))
            .or(status_str_online)
            .unwrap_or(true)
    };

    Some(DayZServerStatus {
        server_ip: server_ip.to_string(),
        query_port,
        game_port,
        is_online,
        server_name,
        map_name,
        players_count,
        max_players,
        bots_count: 0,
        ping_ms,
        environment: "Linux".to_string(),
        game_version: version,
        queue_size,
        last_queried_at: now_iso(),
        error: if is_online { None } else { Some("CFTools reported server offline".to_string()) },
    })
}

/// Computes the CFTools SHA-1 resource ID for DayZ servers: sha1(game + ip + port)
pub fn compute_cftools_resource_id(game: &str, ip: &str, port: u16) -> String {
    let mut hasher = Sha1::new();
    hasher.update(game.as_bytes());
    hasher.update(ip.as_bytes());
    hasher.update(port.to_string().as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

fn now_iso() -> String {
    // Formats a clean ISO-8601 UTC timestamp using std
    use std::time::SystemTime;
    let now = SystemTime::now();
    let duration = now.duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let days = secs / 86400;
    let day_secs = secs % 86400;
    let hours = day_secs / 3600;
    let minutes = (day_secs % 3600) / 60;
    let seconds = day_secs % 60;

    // Approximate date calculation for logs
    let year = 1970 + days / 365; // Sufficient for logging
    format!("{}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, (days % 365) / 30 + 1, (days % 30) + 1, hours, minutes, seconds)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_compute_cftools_resource_id() {
        let hash = compute_cftools_resource_id("1", "127.0.0.1", 2302);
        assert_eq!(hash, "c0d1db47b89ade22740fd3b2a5e79393dfc56c90");
    }

    #[test]
    fn test_compute_cftools_resource_id_dayz() {
        let hash = compute_cftools_resource_id("1", "51.89.96.22", 2302);
        assert_eq!(hash.len(), 40);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_parse_cftools_server_details_online() {
        let val = json!({
            "name": "My DayZ Server",
            "map": "ChernarusPlus",
            "online": true,
            "offline": false,
            "status": {
                "players": 15,
                "slots": 60,
                "queue": {
                    "active": true,
                    "size": 3
                }
            }
        });

        let status = parse_cftools_server_details(&val, "127.0.0.1", 2303, Some(2302), 42).unwrap();
        assert!(status.is_online);
        assert_eq!(status.server_name, "My DayZ Server");
        assert_eq!(status.map_name, "ChernarusPlus");
        assert_eq!(status.players_count, 15);
        assert_eq!(status.max_players, 60);
        assert_eq!(status.queue_size, Some(3));
    }

    #[test]
    fn test_parse_cftools_server_details_players_override_stale_offline_flag() {
        // Even if CFTools crawler flags online: false, if there are active players it must be online
        let val = json!({
            "name": "Active Server",
            "map": "Livonia",
            "online": false,
            "offline": true,
            "status": {
                "players": 28,
                "slots": 60
            }
        });

        let status = parse_cftools_server_details(&val, "127.0.0.1", 2303, Some(2302), 42).unwrap();
        assert!(status.is_online);
        assert_eq!(status.players_count, 28);
    }

    #[test]
    fn test_parse_cftools_server_details_offline() {
        let val = json!({
            "name": "Offline Server",
            "map": "Namalsk",
            "online": false,
            "offline": true,
            "status": {
                "players": 0,
                "slots": 60
            }
        });

        let status = parse_cftools_server_details(&val, "127.0.0.1", 2303, Some(2302), 42).unwrap();
        assert!(!status.is_online);
        assert_eq!(status.players_count, 0);
    }
}

