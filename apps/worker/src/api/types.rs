use crate::a2s::DayZServerStatus;
use crate::metrics::WorkerMetrics;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BotConfig {
    pub id: String,
    pub name: String,
    pub discord_token: String,
    pub discord_client_id: String,
    pub server_ip: String,
    pub server_query_port: u16,
    pub server_game_port: Option<u16>,
    pub refresh_interval_secs: u64,
    pub worker_id: Option<String>,
    pub status: String,
    pub activity_format: String,
    #[serde(default = "default_query_type")]
    pub query_type: String,
    pub cftools_server_id: Option<String>,
    #[serde(default)]
    pub custom_status_enabled: bool,
    pub custom_status_text: Option<String>,
}

fn default_query_type() -> String {
    "a2s".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CFToolsApiCredentials {
    pub application_id: Option<String>,
    pub secret: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkerHeartbeatPayload {
    pub worker_id: String,
    pub version: String,
    pub hostname: String,
    pub metrics: WorkerMetrics,
    pub active_bot_ids: Vec<String>,
    pub server_statuses: HashMap<String, DayZServerStatus>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkerHeartbeatResponse {
    pub success: bool,
    pub acknowledged_at: String,
    pub assigned_bots_count: usize,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub cftools: Option<CFToolsApiCredentials>,
}
