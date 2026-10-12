use super::types::{ApiResponse, BotConfig, CFToolsApiCredentials, WorkerHeartbeatPayload, WorkerHeartbeatResponse};
use anyhow::{anyhow, Context, Result};
use reqwest::{header, Client};
use std::collections::HashMap;
use std::time::Duration;
use tracing::debug;

#[derive(Clone)]
pub struct AdminApiClient {
    client: Client,
    base_url: String,
}

impl AdminApiClient {
    pub fn new(base_url: String, secret_key: String) -> Result<Self> {
        let mut headers = header::HeaderMap::new();
        let mut auth_val = header::HeaderValue::from_str(&secret_key)
            .map_err(|e| anyhow!("Invalid secret key header: {}", e))?;
        auth_val.set_sensitive(true);
        headers.insert("X-Worker-Key", auth_val);

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to build HTTP reqwest client")?;

        Ok(Self {
            client,
            base_url,
        })
    }

    /// Fetches bots assigned to this worker or configured for auto-assignment along with CFTools credentials and map dictionary.
    pub async fn fetch_assigned_bots(
        &self,
        worker_id: &str,
    ) -> Result<(Vec<BotConfig>, Option<CFToolsApiCredentials>, Option<HashMap<String, String>>)> {
        let url = format!("{}/api/worker/{}/bots", self.base_url, worker_id);
        debug!("Syncing assigned bots from: {}", url);

        let res = self
            .client
            .get(&url)
            .send()
            .await
            .context("HTTP request failed while fetching bots")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to fetch bots (status {}): {}", status, body));
        }

        let body = res
            .text()
            .await
            .context("Failed to read HTTP response body while fetching bots")?;

        let api_res: ApiResponse<Vec<BotConfig>> = match serde_json::from_str(&body) {
            Ok(parsed) => parsed,
            Err(e) => {
                return Err(anyhow!("Failed to deserialize bots response: {}. Raw response: {}", e, body));
            }
        };

        if let Some(err) = api_res.error {
            return Err(anyhow!("API error: {}", err));
        }

        Ok((api_res.data.unwrap_or_default(), api_res.cftools, api_res.maps))
    }

    /// Sends worker heartbeat with system metrics and live DayZ server statuses.
    pub async fn send_heartbeat(
        &self,
        worker_id: &str,
        payload: &WorkerHeartbeatPayload,
    ) -> Result<WorkerHeartbeatResponse> {
        let url = format!("{}/api/worker/{}/heartbeat", self.base_url, worker_id);

        let res = self
            .client
            .post(&url)
            .json(payload)
            .send()
            .await
            .context("HTTP request failed while sending heartbeat")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to send heartbeat (status {}): {}", status, body));
        }

        let api_res: ApiResponse<WorkerHeartbeatResponse> = res
            .json()
            .await
            .context("Failed to deserialize heartbeat response")?;

        if let Some(err) = api_res.error {
            return Err(anyhow!("API error: {}", err));
        }

        api_res
            .data
            .ok_or_else(|| anyhow!("Empty response data in heartbeat acknowledgment"))
    }
}
