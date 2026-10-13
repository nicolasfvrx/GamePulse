use serde::{Deserialize, Serialize};
use std::time::Instant;
use sysinfo::{get_current_pid, Pid, ProcessesToUpdate, System};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkerMetrics {
    pub cpu_usage_percent: f64,
    pub ram_used_mb: f64,
    pub ram_total_mb: f64,
    pub uptime_seconds: u64,
}

pub struct MetricsCollector {
    sys: System,
    pid: Option<Pid>,
    start_time: Instant,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.refresh_cpu_all();

        let pid = get_current_pid().ok();
        if let Some(p) = pid {
            sys.refresh_processes(ProcessesToUpdate::Some(&[p]), true);
        }

        Self {
            sys,
            pid,
            start_time: Instant::now(),
        }
    }

    pub fn collect(&mut self) -> WorkerMetrics {
        self.sys.refresh_memory();
        self.sys.refresh_cpu_all();

        let num_cpus = self.sys.cpus().len().max(1);

        // Track process-specific CPU and RAM
        let (proc_cpu, proc_ram_mb) = if let Some(pid) = self.pid {
            self.sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
            if let Some(process) = self.sys.process(pid) {
                let cpu = (process.cpu_usage() as f64) / (num_cpus as f64);
                let ram_mb = (process.memory() as f64) / (1024.0 * 1024.0);
                (cpu, ram_mb)
            } else {
                (0.0, 0.0)
            }
        } else {
            // Fallback to global if PID cannot be determined
            let global_cpu = self.sys.global_cpu_usage() as f64;
            let global_ram = (self.sys.used_memory() as f64) / (1024.0 * 1024.0);
            (global_cpu, global_ram)
        };

        let ram_total_mb = (self.sys.total_memory() as f64) / (1024.0 * 1024.0);
        let uptime_seconds = self.start_time.elapsed().as_secs();

        WorkerMetrics {
            cpu_usage_percent: (proc_cpu * 10.0).round() / 10.0,
            ram_used_mb: (proc_ram_mb * 10.0).round() / 10.0,
            ram_total_mb: ram_total_mb.round(),
            uptime_seconds,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_metrics() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();
        assert!(metrics.ram_used_mb >= 0.0);
        assert!(metrics.ram_total_mb > 0.0);
        // Process RAM for a lightweight daemon should be less than 500 MB
        assert!(metrics.ram_used_mb < 500.0);
        println!("Process RAM: {} MB / {} MB", metrics.ram_used_mb, metrics.ram_total_mb);
    }
}
