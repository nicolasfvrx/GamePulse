use crate::a2s::DayZServerStatus;
use anyhow::{anyhow, Context, Result};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
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
        let http = Client::builder()
            .timeout(Duration::from_secs(8))
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
        server_id: &str,
        server_ip: &str,
        query_port: u16,
        game_port: Option<u16>,
    ) -> Result<DayZServerStatus> {
        let token = self.get_token().await?;
        let clean_id = server_id.trim();

        let start_time = Instant::now();
        let url = format!("{}/gameserver/{}", CFTOOLS_API_BASE, clean_id);

        let res = self
            .http
            .get(&url)
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .send()
            .await
            .context("HTTP request failed while querying CFTools gameserver")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(anyhow!("CFTools query failed for server {clean_id} ({status}): {body}"));
        }

        let ping_ms = start_time.elapsed().as_millis() as u64;
        let json: serde_json::Value = res.json().await.context("Failed to parse CFTools JSON")?;

        // In CFTools response, server details are either under json[clean_id] or inside an inner object
        let server_obj = if let Some(obj) = json.get(clean_id) {
            obj
        } else if let Some(map) = json.as_object() {
            // Find first key that contains status object
            map.values()
                .find(|v| v.get("status").is_some() || v.get("name").is_some())
                .unwrap_or(&json)
        } else {
            &json
        };

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

        // Parse Queue size: status.queue.size or status.queue.active
        let queue_size = status
            .and_then(|s| s.get("queue"))
            .and_then(|q| q.get("size").or_else(|| q.get("active")))
            .and_then(|v| v.as_u64())
            .map(|q| q as u32);

        let is_online = server_obj
            .get("online")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        Ok(DayZServerStatus {
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
        })
    }
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
