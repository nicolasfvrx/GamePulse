use crate::a2s::{A2SClient, DayZServerStatus};
use crate::api::BotConfig;
use crate::discord::gateway::DiscordGatewayClient;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tokio::time::interval;
use tracing::{debug, info};

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

pub fn spawn_bot(config: BotConfig) -> ActiveBotHandle {
    let (presence_tx, presence_rx) = mpsc::unbounded_channel::<String>();
    let last_status = Arc::new(RwLock::new(None));

    // 1. Spawn Discord Gateway connection
    let gateway_client = DiscordGatewayClient::new(config.discord_token.clone(), presence_rx);
    let bot_name_clone = config.name.clone();
    let gateway_handle = tokio::spawn(async move {
        gateway_client.run(bot_name_clone).await;
    });

    // 2. Spawn periodic DayZ A2S Query loop
    let query_config = config.clone();
    let query_status = Arc::clone(&last_status);
    let query_handle = tokio::spawn(async move {
        let refresh_secs = query_config.refresh_interval_secs.max(10);
        let mut ticker = interval(Duration::from_secs(refresh_secs));

        info!(
            "[{}] Starting A2S query loop on {}:{} (refresh every {}s)",
            query_config.name, query_config.server_ip, query_config.server_query_port, refresh_secs
        );

        loop {
            ticker.tick().await;

            let status = A2SClient::query_server(
                &query_config.server_ip,
                query_config.server_query_port,
                query_config.server_game_port,
                Duration::from_secs(4),
            )
            .await;

            // Format presence string
            let presence_text = format_presence(&query_config.activity_format, &status);
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

pub fn format_presence(template: &str, status: &DayZServerStatus) -> String {
    if !status.is_online {
        return "DayZ - Serveur Hors Ligne".to_string();
    }

    let map = if status.map_name.is_empty() { "Chernarus" } else { &status.map_name };
    let server_name = if status.server_name.is_empty() { "DayZ Server" } else { &status.server_name };

    template
        .replace("{map}", map)
        .replace("{players}", &status.players_count.to_string())
        .replace("{max_players}", &status.max_players.to_string())
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
            query_port: 2305,
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
            last_queried_at: "2026-10-12".into(),
            error: None,
        };

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status);
        assert_eq!(result, "Joue à DayZ - ChernarusPlus [34/60]");
    }

    #[test]
    fn test_format_presence_offline() {
        let status = DayZServerStatus {
            server_ip: "127.0.0.1".into(),
            query_port: 2305,
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
            last_queried_at: "2026-10-12".into(),
            error: Some("Timeout".into()),
        };

        let result = format_presence("Joue à DayZ - {map} [{players}/{max_players}]", &status);
        assert_eq!(result, "DayZ - Serveur Hors Ligne");
    }
}
