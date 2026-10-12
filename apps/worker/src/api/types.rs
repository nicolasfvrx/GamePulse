use crate::a2s::DayZServerStatus;
use crate::metrics::WorkerMetrics;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BotConfig {
    pub id: String,
    pub name: String,
    pub discord_token: String,
    pub discord_client_id: String,
    pub server_ip: String,
    #[serde(default = "default_query_port")]
    pub server_query_port: u16,
    #[serde(default)]
    pub server_game_port: Option<u16>,
    #[serde(default = "default_refresh_interval")]
    pub refresh_interval_secs: u64,
    #[serde(default)]
    pub worker_id: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_activity_format")]
    pub activity_format: String,
    #[serde(default = "default_query_type")]
    pub query_type: String,
    #[serde(default)]
    pub cftools_server_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_bool_flexible")]
    pub custom_status_enabled: bool,
    #[serde(default)]
    pub custom_status_text: Option<String>,
}

fn default_query_port() -> u16 {
    2303
}

fn default_refresh_interval() -> u64 {
    20
}

fn default_status() -> String {
    "active".to_string()
}

fn default_activity_format() -> String {
    "Joue à DayZ - {map} [{players}/{max_players}]".to_string()
}

fn default_query_type() -> String {
    "a2s".to_string()
}

pub fn deserialize_bool_flexible<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    struct BoolVisitor;

    impl<'de> serde::de::Visitor<'de> for BoolVisitor {
        type Value = bool;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a boolean, integer (0 or 1), string, or null")
        }

        fn visit_bool<E>(self, v: bool) -> Result<bool, E> {
            Ok(v)
        }

        fn visit_i64<E>(self, v: i64) -> Result<bool, E> {
            Ok(v != 0)
        }

        fn visit_u64<E>(self, v: u64) -> Result<bool, E> {
            Ok(v != 0)
        }

        fn visit_str<E>(self, v: &str) -> Result<bool, E> {
            match v.to_lowercase().as_str() {
                "true" | "1" => Ok(true),
                _ => Ok(false),
            }
        }

        fn visit_none<E>(self) -> Result<bool, E> {
            Ok(false)
        }

        fn visit_unit<E>(self) -> Result<bool, E> {
            Ok(false)
        }
    }

    deserializer.deserialize_any(BoolVisitor)
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct CFToolsApiCredentials {
    #[serde(default)]
    pub application_id: Option<String>,
    #[serde(default)]
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

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct WorkerHeartbeatResponse {
    pub success: bool,
    pub acknowledged_at: String,
    pub assigned_bots_count: usize,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(default)]
    pub data: Option<T>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub cftools: Option<CFToolsApiCredentials>,
    #[serde(default)]
    pub maps: Option<HashMap<String, String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_legacy_bots_response_without_cftools() {
        // Simulates an older or basic response missing the 'cftools' key
        let json = r#"{
            "success": true,
            "data": [
                {
                    "id": "bot-1",
                    "name": "Bot 1",
                    "discord_token": "token123",
                    "discord_client_id": "client123",
                    "server_ip": "127.0.0.1",
                    "status": "active"
                }
            ]
        }"#;

        let res: ApiResponse<Vec<BotConfig>> = serde_json::from_str(json).unwrap();
        assert!(res.success);
        let bots = res.data.unwrap();
        assert_eq!(bots.len(), 1);
        assert_eq!(bots[0].server_query_port, 2303);
        assert_eq!(bots[0].custom_status_enabled, false);
        assert_eq!(bots[0].query_type, "a2s");
        assert!(res.cftools.is_none());
    }

    #[test]
    fn test_deserialize_sqlite_integer_boolean() {
        // SQLite D1 returns integers (0 / 1) for booleans
        let json = r#"{
            "success": true,
            "data": [
                {
                    "id": "bot-sqlite",
                    "name": "Bot SQLite",
                    "discord_token": "token",
                    "discord_client_id": "client",
                    "server_ip": "1.2.3.4",
                    "custom_status_enabled": 1,
                    "custom_status_text": "Maintenance",
                    "query_type": "cftools",
                    "cftools_server_id": "cft-abc"
                }
            ],
            "cftools": {
                "application_id": "app-id",
                "secret": null
            }
        }"#;

        let res: ApiResponse<Vec<BotConfig>> = serde_json::from_str(json).unwrap();
        let bots = res.data.unwrap();
        assert_eq!(bots[0].custom_status_enabled, true);
        assert_eq!(bots[0].custom_status_text.as_deref(), Some("Maintenance"));
        assert_eq!(bots[0].query_type, "cftools");
        assert_eq!(bots[0].cftools_server_id.as_deref(), Some("cft-abc"));
        assert_eq!(res.cftools.unwrap().application_id.as_deref(), Some("app-id"));
    }
}
