use crate::api::{AdminApiClient, WorkerHeartbeatPayload};
use crate::cftools::CFToolsClient;
use crate::config::Config;
use crate::discord::BotManager;
use crate::metrics::MetricsCollector;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

pub struct WorkerPoller {
    config: Config,
    api_client: AdminApiClient,
    cftools_client: Arc<CFToolsClient>,
    metrics: MetricsCollector,
    manager: BotManager,
}

impl WorkerPoller {
    pub fn new(config: Config, api_client: AdminApiClient) -> Self {
        let cftools_client = Arc::new(CFToolsClient::new(
            config.cftools_application_id.clone(),
            config.cftools_secret.clone(),
        ));
        let manager = BotManager::new(Arc::clone(&cftools_client));

        Self {
            config,
            api_client,
            cftools_client,
            metrics: MetricsCollector::new(),
            manager,
        }
    }

    pub async fn run(mut self) {
        let interval_secs = self.config.poll_interval_secs.max(5);
        let mut ticker = interval(Duration::from_secs(interval_secs));

        info!(
            "Worker poller started. Polling Cloudflare API every {}s (Worker ID: {})",
            interval_secs, self.config.worker_id
        );

        loop {
            ticker.tick().await;

            // 1. Fetch desired bots, CFTools credentials, and map dictionary from Cloudflare API
            match self.api_client.fetch_assigned_bots(&self.config.worker_id).await {
                Ok((assigned_bots, cftools_creds, maps)) => {
                    debug!("Fetched {} bots from Cloudflare API", assigned_bots.len());
                    if let Some(creds) = cftools_creds {
                        if creds.application_id.is_some() || creds.secret.is_some() {
                            self.cftools_client
                                .update_credentials(creds.application_id, creds.secret)
                                .await;
                        }
                    }
                    if let Some(map_dict) = maps {
                        self.manager.update_maps(map_dict).await;
                    }
                    self.manager.sync_bots(assigned_bots);
                }
                Err(e) => {
                    warn!("Failed to sync bots from Cloudflare API: {}", e);
                }
            }

            // 2. Collect system metrics
            let current_metrics = self.metrics.collect();

            // 3. Collect DayZ server query statuses
            let server_statuses = self.manager.collect_server_statuses().await;
            let active_bot_ids = self.manager.get_active_bot_ids();

            // 4. Send Heartbeat
            let heartbeat_payload = WorkerHeartbeatPayload {
                worker_id: self.config.worker_id.clone(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                hostname: self.config.hostname.clone(),
                metrics: current_metrics.clone(),
                active_bot_ids,
                server_statuses,
            };

            match self.api_client.send_heartbeat(&self.config.worker_id, &heartbeat_payload).await {
                Ok(ack) => {
                    info!(
                        "[Heartbeat] Ack at {}. CPU: {}%, RAM: {}/{} MB, Bots: {}",
                        ack.acknowledged_at,
                        current_metrics.cpu_usage_percent,
                        current_metrics.ram_used_mb,
                        current_metrics.ram_total_mb,
                        heartbeat_payload.active_bot_ids.len()
                    );
                }
                Err(e) => {
                    error!("Failed to send heartbeat to Cloudflare API: {}", e);
                }
            }
        }
    }
}
