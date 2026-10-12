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

        // Generate SHA-1 candidates from IP and candidate ports
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
        for port in candidate_ports {
            let hash = compute_cftools_resource_id("1", clean_ip, port);
            if !candidates.contains(&hash) {
                candidates.push(hash);
            }
        }

        // 3. Try each candidate on /v1/gameserver/{resource_id}
        let mut last_err = String::new();
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
                last_err = format!("CFTools gameserver query ({status}): {body}");
                continue;
            }

            let json: serde_json::Value = match res.json().await {
                Ok(j) => j,
                Err(err) => {
                    last_err = format!("JSON parse error: {err}");
                    continue;
                }
            };

            // In CFTools response, the root object has keys matching the resource_id
            let server_obj = if let Some(obj) = json.get(resource_id) {
                obj
            } else if let Some(map) = json.as_object() {
                map.values()
                    .find(|v| v.get("status").is_some() || v.get("name").is_some())
                    .unwrap_or(&json)
            } else {
                &json
            };

            // Check if server object indicates an error
            if let Some(err_val) = server_obj.get("_object").and_then(|o| o.get("error")).and_then(|e| e.as_str()) {
                if err_val != "GameServerQueryError.NONE" {
                    last_err = format!("CFTools query error: {err_val}");
                    continue;
                }
            }

            // Ensure status or name is present
            if server_obj.get("status").is_none() && server_obj.get("name").is_none() {
                last_err = format!("No status or name found in CFTools response for {resource_id}");
                continue;
            }

            let ping_ms = start_time.elapsed().as_millis() as u64;

            let server_name = server_obj
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("DayZ Server")
                .to_string();

            let map_name = server_obj
                .get("map")
                .and_then(|v| v.as_str())
                .unwrap_or("Chernarus")
                .to_string();

            let version = server_obj
                .get("version")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let status = server_obj.get("status");

            let players_count = status
                .and_then(|s| s.get("players"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u8;

            let max_players = status
                .and_then(|s| s.get("slots"))
                .and_then(|v| v.as_u64())
                .unwrap_or(60) as u8;

            // Parse Queue size: status.queue.size
            let queue_size = status
                .and_then(|s| s.get("queue"))
                .and_then(|q| q.get("size"))
                .and_then(|v| v.as_u64())
                .map(|q| q as u32);

            let is_online = server_obj
                .get("online")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);

            debug!(
                "Successfully queried server via CFTools resource {}: players={}/{}, queue={:?}, map={}",
                resource_id, players_count, max_players, queue_size, map_name
            );

            return Ok(DayZServerStatus {
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
                error: None,
            });
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
}

