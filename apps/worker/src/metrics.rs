use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkerMetrics {
    pub cpu_usage_percent: f64,
    pub ram_used_mb: f64,
    pub ram_total_mb: f64,
    pub uptime_seconds: u64,
}

pub struct MetricsCollector {
    sys: System,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self { sys }
    }

    pub fn collect(&mut self) -> WorkerMetrics {
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();

        let cpus = self.sys.cpus();
        let cpu_usage_percent = if !cpus.is_empty() {
            let total_cpu: f32 = cpus.iter().map(|c| c.cpu_usage()).sum();
            (total_cpu as f64) / (cpus.len() as f64)
        } else {
            self.sys.global_cpu_usage() as f64
        };

        // sysinfo 0.30+ reports memory in bytes
        let ram_used_mb = (self.sys.used_memory() as f64) / (1024.0 * 1024.0);
        let ram_total_mb = (self.sys.total_memory() as f64) / (1024.0 * 1024.0);
        let uptime_seconds = System::uptime();

        WorkerMetrics {
            cpu_usage_percent: (cpu_usage_percent * 10.0).round() / 10.0,
            ram_used_mb: ram_used_mb.round(),
            ram_total_mb: ram_total_mb.round(),
            uptime_seconds,
        }
    }
}
