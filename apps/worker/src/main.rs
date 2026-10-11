pub mod a2s;
pub mod api;
pub mod config;
pub mod discord;
pub mod metrics;
pub mod poller;

use api::AdminApiClient;
use config::Config;
use poller::WorkerPoller;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Initialize tracing logger
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set global tracing subscriber");

    // 2. Load configuration
    let config = Config::from_env();

    info!("==================================================");
    info!("     GamePulse - Discord Presence Worker Daemon   ");
    info!("     Version: {}                             ", env!("CARGO_PKG_VERSION"));
    info!("==================================================");
    info!("Worker ID       : {}", config.worker_id);
    info!("Hostname        : {}", config.hostname);
    info!("Control Plane   : {}", config.admin_api_url);
    info!("Poll Interval   : {}s", config.poll_interval_secs);
    info!("==================================================");

    // 3. Initialize Cloudflare API Client
    let api_client = AdminApiClient::new(
        config.admin_api_url.clone(),
        config.worker_secret_key.clone(),
    )?;

    // 4. Start poller and bot coordinator
    let poller = WorkerPoller::new(config, api_client);

    tokio::select! {
        _ = poller.run() => {},
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal (Ctrl+C). Terminating worker cleanly...");
        }
    }

    info!("Worker shutdown complete.");
    Ok(())
}
