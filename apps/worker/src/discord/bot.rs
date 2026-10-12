use crate::a2s::{A2SClient, DayZServerStatus};
use crate::api::BotConfig;
use crate::cftools::CFToolsClient;
use crate::discord::gateway::DiscordGatewayClient;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tokio::time::interval;
use tracing::{debug, info, warn};

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

pub fn spawn_bot(config: BotConfig, cftools_client: Arc<CFToolsClient>) -> ActiveBotHandle {
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
                if let Some(ref server_id) = query_config.cftools_server_id {
                    match cftools_client.query_server(
                        server_id,
                        &query_config.server_ip,
                        query_config.server_query_port,
                        query_config.server_game_port,
                    ).await {
                        Ok(s) => s,
                        Err(err) => {
                            warn!("[{}] CFTools query error: {}. Falling back to A2S...", query_config.name, err);
                            A2SClient::query_server(
                                &query_config.server_ip,
                                query_config.server_query_port,
                                query_config.server_game_port,
                                Duration::from_secs(4),
                            ).await
                        }
                    }
                } else {
                    A2SClient::query_server(
                        &query_config.server_ip,
                        query_config.server_query_port,
                        query_config.server_game_port,
                        Duration::from_secs(4),
                    ).await
                }
            } else {
                A2SClient::query_server(
                    &query_config.server_ip,
                    query_config.server_query_port,
                    query_config.server_game_port,
                    Duration::from_secs(4),
                ).await
            };

            // Format presence string
            let presence_text = format_presence(
                &query_config.activity_format,
                &status,
                query_config.custom_status_enabled,
                query_config.custom_status_text.as_deref(),
            );
            let _ = presence_tx.send(presence_text);

            // Store status
            {
                let mut lock = query_status.write().await;
                *lock = Some(status);
            }
            debug!("[{}] Updated server status & presence", query_config.name);
        }
    });

    ActiveBotHandle {
        config,
        last_status,
        gateway_handle,
        query_handle,
    }
}

pub fn format_presence(
    template: &str,
    status: &DayZServerStatus,
    custom_status_enabled: bool,
    custom_status_text: Option<&str>,
) -> String {
    if custom_status_enabled {
        if let Some(custom) = custom_status_text {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    if !status.is_online {
        return "DayZ - Serveur Hors Ligne".to_string();
    }

    let map = if status.map_name.is_empty() { "Chernarus" } else { &status.map_name };
    let server_name = if status.server_name.is_empty() { "DayZ Server" } else { &status.server_name };
    let queue_num = status.queue_size.unwrap_or(0);
    let queue_suffix = if queue_num > 0 {
        format!(" (+{})", queue_num)
    } else {
        "".to_string()
    };

    template
        .replace("{map}", map)
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

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status, false, None);
        assert_eq!(result, "Joue à DayZ - ChernarusPlus [34/60]");
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

        let result = format_presence("{players}/{max_players}{queue_suffix}", &status, false, None);
        assert_eq!(result, "60/60 (+7)");

        let result_explicit = format_presence("{players}/{max_players} (File: {queue})", &status, false, None);
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
        );
        assert_eq!(result, "Ouverture du serveur à 20h !");
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

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status, false, None);
        assert_eq!(result, "DayZ - Serveur Hors Ligne");
    }
}
