use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub worker_id: String,
    pub worker_name: String,
    pub worker_secret_key: String,
    pub admin_api_url: String,
    pub poll_interval_secs: u64,
    pub hostname: String,
}

impl Config {
    pub fn from_env() -> Self {
        let _ = dotenvy::dotenv();

        let hostname = sysinfo::System::host_name()
            .unwrap_or_else(|| "dayz-worker-node".to_string());

        let worker_id = env::var("WORKER_ID")
            .unwrap_or_else(|_| format!("worker-{}", hostname));

        let worker_name = env::var("WORKER_NAME")
            .unwrap_or_else(|_| format!("Worker ({})", worker_id));

        let worker_secret_key = env::var("WORKER_SECRET_KEY")
            .unwrap_or_else(|_| "dayz-worker-secret-token-change-in-prod".to_string());

        let admin_api_url = env::var("ADMIN_API_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8788".to_string())
            .trim_end_matches('/')
            .to_string();

        let poll_interval_secs = env::var("POLL_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(20);

        Self {
            worker_id,
            worker_name,
            worker_secret_key,
            admin_api_url,
            poll_interval_secs,
            hostname,
        }
    }
}
