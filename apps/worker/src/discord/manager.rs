use crate::a2s::DayZServerStatus;
use crate::api::BotConfig;
use crate::cftools::CFToolsClient;
use crate::discord::bot::{spawn_bot, ActiveBotHandle};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

pub struct BotManager {
    bots: HashMap<String, ActiveBotHandle>,
    cftools_client: Arc<CFToolsClient>,
    map_dictionary: Arc<RwLock<HashMap<String, String>>>,
}

impl BotManager {
    pub fn new(cftools_client: Arc<CFToolsClient>) -> Self {
        Self {
            bots: HashMap::new(),
            cftools_client,
            map_dictionary: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn cftools_client(&self) -> &Arc<CFToolsClient> {
        &self.cftools_client
    }

    pub async fn update_maps(&self, new_maps: HashMap<String, String>) {
        let mut lock = self.map_dictionary.write().await;
        *lock = new_maps;
    }

    /// Reconciles currently running bots against desired configuration from Cloudflare API.
    pub fn sync_bots(&mut self, desired_bots: Vec<BotConfig>) {
        let desired_active: Vec<BotConfig> = desired_bots
            .into_iter()
            .filter(|b| b.status == "active")
            .collect();

        let desired_ids: HashSet<String> = desired_active.iter().map(|b| b.id.clone()).collect();

        // 1. Stop and remove bots no longer desired
        let current_ids: Vec<String> = self.bots.keys().cloned().collect();
        for id in current_ids {
            if !desired_ids.contains(&id) {
                if let Some(bot) = self.bots.remove(&id) {
                    info!("Stopping removed/paused bot: {}", bot.config.name);
                    bot.stop();
                }
            }
        }

        // 2. Add or update bots
        for config in desired_active {
            if let Some(existing) = self.bots.get(&config.id) {
                // Check if important config changed
                let config_changed = existing.config.server_ip != config.server_ip
                    || existing.config.server_query_port != config.server_query_port
                    || existing.config.server_game_port != config.server_game_port
                    || existing.config.discord_token != config.discord_token
                    || existing.config.refresh_interval_secs != config.refresh_interval_secs
                    || existing.config.activity_format != config.activity_format
                    || existing.config.query_type != config.query_type
                    || existing.config.cftools_server_id != config.cftools_server_id
                    || existing.config.custom_status_enabled != config.custom_status_enabled
                    || existing.config.custom_status_text != config.custom_status_text;

                if config_changed {
                    info!("Restarting updated bot: {}", config.name);
                    if let Some(old_bot) = self.bots.remove(&config.id) {
                        old_bot.stop();
                    }
                    let handle = spawn_bot(
                        config.clone(),
                        Arc::clone(&self.cftools_client),
                        Arc::clone(&self.map_dictionary),
                    );
                    self.bots.insert(config.id.clone(), handle);
                }
            } else {
                info!("Starting new bot: {} ({}:{})", config.name, config.server_ip, config.server_query_port);
                let handle = spawn_bot(
                    config.clone(),
                    Arc::clone(&self.cftools_client),
                    Arc::clone(&self.map_dictionary),
                );
                self.bots.insert(config.id.clone(), handle);
            }
        }
    }

    /// Collects the latest server query status for each active bot.
    pub async fn collect_server_statuses(&self) -> HashMap<String, DayZServerStatus> {
        let mut map = HashMap::new();
        for (id, handle) in &self.bots {
            let lock = handle.last_status.read().await;
            if let Some(status) = lock.as_ref() {
                map.insert(id.clone(), status.clone());
            }
        }
        map
    }

    /// Returns list of active bot IDs.
    pub fn get_active_bot_ids(&self) -> Vec<String> {
        self.bots.keys().cloned().collect()
    }
}
