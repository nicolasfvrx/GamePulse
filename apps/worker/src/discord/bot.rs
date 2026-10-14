use crate::a2s::{A2SClient, DayZServerStatus};
use crate::api::BotConfig;
use crate::cftools::CFToolsClient;
use crate::discord::gateway::DiscordGatewayClient;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tokio::time::interval;
use tracing::{info, warn};

pub struct ActiveBotHandle {
    pub config: BotConfig,
    pub last_status: Arc<RwLock<Option<DayZServerStatus>>>,
    gateway_handle: JoinHandle<()>,
    query_handle: JoinHandle<()>,
}

impl ActiveBotHandle {
    pub fn stop(self) {
        self.gateway_handle.abort();
        self.query_handle.abort();
    }
}

pub fn spawn_bot(
    config: BotConfig,
    cftools_client: Arc<CFToolsClient>,
    map_dictionary: Arc<RwLock<HashMap<String, String>>>,
) -> ActiveBotHandle {
    let (presence_tx, presence_rx) = mpsc::unbounded_channel::<String>();
    let last_status = Arc::new(RwLock::new(None));

    // 1. Spawn Discord Gateway connection
    let gateway_client = DiscordGatewayClient::new(config.discord_token.clone(), presence_rx);
    let bot_name_clone = config.name.clone();
    let gateway_handle = tokio::spawn(async move {
        gateway_client.run(bot_name_clone).await;
    });

    // 2. Spawn periodic DayZ Query loop (Steam A2S or CFTools Cloud)
    let query_config = config.clone();
    let query_status = Arc::clone(&last_status);
    let query_handle = tokio::spawn(async move {
        let refresh_secs = query_config.refresh_interval_secs.max(10);
        let mut ticker = interval(Duration::from_secs(refresh_secs));

        let is_cftools = query_config.query_type == "cftools" && query_config.cftools_server_id.is_some();
        info!(
            "[{}] Starting {} query loop on {}:{} (refresh every {}s)",
            query_config.name,
            if is_cftools { "CFTools Cloud" } else { "A2S" },
            query_config.server_ip,
            query_config.server_query_port,
            refresh_secs
        );

        loop {
            ticker.tick().await;

            let status = if query_config.query_type == "cftools" {
                info!("[{}] Polling DayZ server via CFTools Cloud ({}:{})...", query_config.name, query_config.server_ip, query_config.server_query_port);
                match cftools_client.query_server(
                    query_config.cftools_server_id.as_deref(),
                    &query_config.server_ip,
                    query_config.server_query_port,
                    query_config.server_game_port,
                ).await {
                    Ok(s) if s.is_online => {
                        info!(
                            "[{}] CFTools SUCCESS (Online): \"{}\" | Map: {} | Players: {}/{} | Queue: {} | Ping: {}ms",
                            query_config.name,
                            s.server_name,
                            s.map_name,
                            s.players_count,
                            s.max_players,
                            s.queue_size.unwrap_or(0),
                            s.ping_ms
                        );
                        s
                    }
                    Ok(s) => {
                        warn!(
                            "[{}] CFTools marked server as OFFLINE. Verifying via direct Steam A2S query on {}:{} to prevent false positives...",
                            query_config.name,
                            query_config.server_ip,
                            query_config.server_query_port
                        );
                        let mut a2s_res = A2SClient::query_server(
                            &query_config.server_ip,
                            query_config.server_query_port,
                            query_config.server_game_port,
                            Duration::from_secs(4),
                        ).await;

                        if a2s_res.is_online {
                            info!(
                                "[{}] A2S Verification SUCCESS (server is actually ONLINE!): \"{}\" | Map: {} | Players: {}/{} | Ping: {}ms",
                                query_config.name,
                                a2s_res.server_name,
                                a2s_res.map_name,
                                a2s_res.players_count,
                                a2s_res.max_players,
                                a2s_res.ping_ms
                            );
                            if a2s_res.queue_size.is_none() && s.queue_size.is_some() {
                                a2s_res.queue_size = s.queue_size;
                            }
                            a2s_res
                        } else {
                            warn!(
                                "[{}] A2S Verification confirmed server is OFFLINE: {}",
                                query_config.name,
                                a2s_res.error.as_deref().unwrap_or("Server unreachable")
                            );
                            s
                        }
                    }
                    Err(err) => {
                        warn!(
                            "[{}] CFTools FAILED: {}. Falling back to Steam A2S UDP query on {}:{}...",
                            query_config.name,
                            err,
                            query_config.server_ip,
                            query_config.server_query_port
                        );
                        let a2s_res = A2SClient::query_server(
                            &query_config.server_ip,
                            query_config.server_query_port,
                            query_config.server_game_port,
                            Duration::from_secs(4),
                        ).await;
                        if a2s_res.is_online {
                            info!(
                                "[{}] A2S Fallback SUCCESS: \"{}\" | Map: {} | Players: {}/{} | Ping: {}ms",
                                query_config.name,
                                a2s_res.server_name,
                                a2s_res.map_name,
                                a2s_res.players_count,
                                a2s_res.max_players,
                                a2s_res.ping_ms
                            );
                        } else {
                            warn!(
                                "[{}] A2S Fallback FAILED (Offline): {}",
                                query_config.name,
                                a2s_res.error.as_deref().unwrap_or("Query timed out or host unreachable")
                            );
                        }
                        a2s_res
                    }
                }
            } else {
                info!("[{}] Polling DayZ server via Steam A2S UDP ({}:{})...", query_config.name, query_config.server_ip, query_config.server_query_port);
                let a2s_res = A2SClient::query_server(
                    &query_config.server_ip,
                    query_config.server_query_port,
                    query_config.server_game_port,
                    Duration::from_secs(4),
                ).await;
                if a2s_res.is_online {
                    info!(
                        "[{}] A2S SUCCESS: \"{}\" | Map: {} | Players: {}/{} | Ping: {}ms",
                        query_config.name,
                        a2s_res.server_name,
                        a2s_res.map_name,
                        a2s_res.players_count,
                        a2s_res.max_players,
                        a2s_res.ping_ms
                    );
                } else {
                    warn!(
                        "[{}] A2S FAILED (Offline): {}",
                        query_config.name,
                        a2s_res.error.as_deref().unwrap_or("Query timed out or host unreachable")
                    );
                }
                a2s_res
            };

            // Format presence string
            let presence_text = {
                let dict_lock = map_dictionary.read().await;
                format_presence(
                    &query_config.activity_format,
                    &status,
                    query_config.custom_status_enabled,
                    query_config.custom_status_text.as_deref(),
                    Some(&dict_lock),
                )
            };
            info!("[{}] Presence -> \"{}\"", query_config.name, presence_text);
            let _ = presence_tx.send(presence_text);

            // Store status
            {
                let mut lock = query_status.write().await;
                *lock = Some(status);
            }
        }
    });

    ActiveBotHandle {
        config,
        last_status,
        gateway_handle,
        query_handle,
    }
}

pub fn resolve_map_name(raw: &str, dict: &HashMap<String, String>) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "Chernarus".to_string();
    }
    let lower = trimmed.to_lowercase();
    if let Some(mapped) = dict.get(&lower) {
        return mapped.clone();
    }

    // Default known DayZ maps fallback
    match lower.as_str() {
        "chernarusplus" | "chernarus" => "Chernarus".to_string(),
        "enoch" => "Livonia".to_string(),
        "namalsk" => "Namalsk".to_string(),
        "takistanplus" | "takistan" => "Takistan+".to_string(),
        "deerisle" => "Deer Isle".to_string(),
        "rostow" => "Rostow".to_string(),
        "esseker" => "Esseker".to_string(),
        "valning" => "Välning".to_string(),
        "banov" => "Banov".to_string(),
        "pripyat" => "Pripyat".to_string(),
        "chiemsee" => "Chiemsee".to_string(),
        "melkart" => "Melkart".to_string(),
        "arland" => "Arland".to_string(),
        "everon" => "Everon".to_string(),
        "sakhal" => "Sakhal".to_string(),
        "anizay" => "Anizay".to_string(),
        "barrington" => "Barrington".to_string(),
        "iztek" => "Iztek".to_string(),
        "alteria" => "Alteria".to_string(),
        "archana" => "Archana".to_string(),
        _ => {
            // Capitalize first letter fallback
            let mut chars = trimmed.chars();
            match chars.next() {
                None => "Chernarus".to_string(),
                Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}

pub fn format_presence(
    template: &str,
    status: &DayZServerStatus,
    custom_status_enabled: bool,
    custom_status_text: Option<&str>,
    map_dictionary: Option<&HashMap<String, String>>,
) -> String {
    let empty_dict = HashMap::new();
    let dict = map_dictionary.unwrap_or(&empty_dict);
    let resolved_map = resolve_map_name(&status.map_name, dict);
    let server_name = if status.server_name.is_empty() { "DayZ Server" } else { &status.server_name };
    let queue_num = status.queue_size.unwrap_or(0);
    let queue_suffix = if queue_num > 0 {
        format!(" (+{})", queue_num)
    } else {
        "".to_string()
    };

    if custom_status_enabled {
        if let Some(custom) = custom_status_text {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                if status.is_online {
                    return trimmed
                        .replace("{map}", &resolved_map)
                        .replace("{players}", &status.players_count.to_string())
                        .replace("{max_players}", &status.max_players.to_string())
                        .replace("{queue}", &queue_num.to_string())
                        .replace("{queue_suffix}", &queue_suffix)
                        .replace("{server_name}", server_name)
                        .replace("{ping}", &format!("{}ms", status.ping_ms));
                } else {
                    return trimmed.to_string();
                }
            }
        }
    }

    if !status.is_online {
        return "DayZ - Serveur Hors Ligne".to_string();
    }

    template
        .replace("{map}", &resolved_map)
        .replace("{players}", &status.players_count.to_string())
        .replace("{max_players}", &status.max_players.to_string())
        .replace("{queue}", &queue_num.to_string())
        .replace("{queue_suffix}", &queue_suffix)
        .replace("{server_name}", server_name)
        .replace("{ping}", &format!("{}ms", status.ping_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_presence_online() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2303,
            game_port: Some(2302),
            is_online: true,
            server_name: "My Chernarus Server".into(),
            map_name: "ChernarusPlus".into(),
            players_count: 34,
            max_players: 60,
            bots_count: 0,
            ping_ms: 22,
            environment: "Linux".into(),
            game_version: Some("1.24".into()),
            queue_size: None,
            last_queried_at: "2026-10-12".into(),
            error: None,
        };

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status, false, None, None);
        assert_eq!(result, "Joue à DayZ - Chernarus [34/60]");
    }

    #[test]
    fn test_format_presence_with_queue() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2303,
            game_port: Some(2302),
            is_online: true,
            server_name: "My Chernarus Server".into(),
            map_name: "ChernarusPlus".into(),
            players_count: 60,
            max_players: 60,
            bots_count: 0,
            ping_ms: 18,
            environment: "Linux".into(),
            game_version: Some("1.24".into()),
            queue_size: Some(7),
            last_queried_at: "2026-10-12".into(),
            error: None,
        };

        let result = format_presence("{players}/{max_players}{queue_suffix}", &status, false, None, None);
        assert_eq!(result, "60/60 (+7)");

        let result_explicit = format_presence("{players}/{max_players} (File: {queue})", &status, false, None, None);
        assert_eq!(result_explicit, "60/60 (File: 7)");
    }

    #[test]
    fn test_format_presence_custom_status() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2303,
            game_port: Some(2302),
            is_online: true,
            server_name: "My Chernarus Server".into(),
            map_name: "ChernarusPlus".into(),
            players_count: 0,
            max_players: 60,
            bots_count: 0,
            ping_ms: 10,
            environment: "Linux".into(),
            game_version: Some("1.24".into()),
            queue_size: None,
            last_queried_at: "2026-10-12".into(),
            error: None,
        };

        let result = format_presence(
            "[{players}/{max_players}]",
            &status,
            true,
            Some("Ouverture du serveur à 20h !"),
            None,
        );
        assert_eq!(result, "Ouverture du serveur à 20h !");
    }

    #[test]
    fn test_format_presence_with_map_translation() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2303,
            game_port: Some(2302),
            is_online: true,
            server_name: "My Takistan Server".into(),
            map_name: "takistanplus".into(),
            players_count: 42,
            max_players: 70,
            bots_count: 0,
            ping_ms: 15,
            environment: "Linux".into(),
            game_version: Some("1.24".into()),
            queue_size: None,
            last_queried_at: "2026-10-12".into(),
            error: None,
        };

        // 1. Default mapping: takistanplus -> Takistan+
        let default_res = format_presence("Map: {map}", &status, false, None, None);
        assert_eq!(default_res, "Map: Takistan+");

        // 2. Custom dictionary override
        let mut custom_dict = HashMap::new();
        custom_dict.insert("takistanplus".to_string(), "Takistan Plus Modded".to_string());
        let custom_res = format_presence("Map: {map}", &status, false, None, Some(&custom_dict));
        assert_eq!(custom_res, "Map: Takistan Plus Modded");
    }

    #[test]
    fn test_format_presence_offline() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2303,
            game_port: None,
            is_online: false,
            server_name: "".into(),
            map_name: "".into(),
            players_count: 0,
            max_players: 60,
            bots_count: 0,
            ping_ms: 0,
            environment: "Unknown".into(),
            game_version: None,
            queue_size: None,
            last_queried_at: "2026-10-12".into(),
            error: Some("Timeout".into()),
        };

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status, false, None, None);
        assert_eq!(result, "DayZ - Serveur Hors Ligne");
    }
}
