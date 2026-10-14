use super::packet::{build_info_packet, parse_info_response};
use super::types::{A2SError, DayZServerStatus};
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::{timeout, Instant};
use tracing::{debug, warn};

pub struct A2SClient;

impl A2SClient {
    /// Queries a DayZ/Steam server via UDP A2S_INFO protocol with challenge handling and timeout.
    pub async fn query_server(
        ip: &str,
        query_port: u16,
        game_port: Option<u16>,
        timeout_dur: Duration,
    ) -> DayZServerStatus {
        let target_addr = format!("{}:{}", ip, query_port);
        let now_iso = chrono_iso_now();

        let start_time = Instant::now();

        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to bind local UDP socket for A2S query: {}", e);
                return Self::offline_status(ip, query_port, game_port, now_iso, format!("Socket bind failed: {}", e));
            }
        };

        if let Err(e) = socket.connect(&target_addr).await {
            warn!("Failed to connect UDP socket to {}: {}", target_addr, e);
            return Self::offline_status(ip, query_port, game_port, now_iso, format!("UDP connect failed: {}", e));
        }

        let attempt_timeout = if timeout_dur.as_millis() >= 2000 {
            Duration::from_millis((timeout_dur.as_millis() / 2) as u64)
        } else {
            timeout_dur
        };

        let mut last_err = "Query timed out".to_string();

        for attempt in 1..=2 {
            let initial_req = build_info_packet(None);
            if let Err(e) = socket.send(&initial_req).await {
                return Self::offline_status(ip, query_port, game_port, now_iso, format!("UDP send failed: {}", e));
            }

            let mut buf = [0u8; 2048];
            let recv_res = timeout(attempt_timeout, socket.recv(&mut buf)).await;
            let bytes_read = match recv_res {
                Ok(Ok(n)) => n,
                Ok(Err(e)) => {
                    last_err = format!("UDP recv error: {}", e);
                    continue;
                }
                Err(_) => {
                    last_err = format!("A2S query timed out (attempt {}/2)", attempt);
                    continue;
                }
            };

            let parse_res = parse_info_response(&buf[..bytes_read]);

            match parse_res {
                Ok(info) => {
                    let ping_ms = start_time.elapsed().as_millis() as u64;
                    return Self::online_status(ip, query_port, game_port, ping_ms, now_iso, info);
                }
                Err(A2SError::ChallengeRequired(challenge)) => {
                    debug!("Server at {} issued A2S challenge, responding...", target_addr);
                    let challenged_req = build_info_packet(Some(challenge));
                    if let Err(e) = socket.send(&challenged_req).await {
                        return Self::offline_status(ip, query_port, game_port, now_iso, format!("Challenge send failed: {}", e));
                    }

                    let second_recv = timeout(attempt_timeout, socket.recv(&mut buf)).await;
                    match second_recv {
                        Ok(Ok(n)) => match parse_info_response(&buf[..n]) {
                            Ok(info) => {
                                let ping_ms = start_time.elapsed().as_millis() as u64;
                                return Self::online_status(ip, query_port, game_port, ping_ms, now_iso, info);
                            }
                            Err(e) => {
                                last_err = format!("Parse error after challenge: {}", e);
                            }
                        },
                        Ok(Err(e)) => {
                            last_err = format!("Recv error after challenge: {}", e);
                        }
                        Err(_) => {
                            last_err = format!("Timed out waiting for challenged response (attempt {}/2)", attempt);
                        }
                    }
                }
                Err(e) => {
                    last_err = format!("Invalid A2S packet: {}", e);
                }
            }
        }

        Self::offline_status(ip, query_port, game_port, now_iso, last_err)
    }

    fn online_status(
        ip: &str,
        query_port: u16,
        game_port: Option<u16>,
        ping_ms: u64,
        timestamp: String,
        info: super::types::A2SInfoResponse,
    ) -> DayZServerStatus {
        let env_str = match info.environment {
            b'w' => "Windows",
            b'm' => "Mac",
            _ => "Linux",
        };

        DayZServerStatus {
            server_ip: ip.to_string(),
            query_port,
            game_port: game_port.or(info.game_port),
            is_online: true,
            server_name: info.name,
            map_name: info.map,
            players_count: info.players,
            max_players: info.max_players,
            bots_count: info.bots,
            ping_ms,
            environment: env_str.to_string(),
            game_version: info.version,
            queue_size: None,
            last_queried_at: timestamp,
            error: None,
        }
    }

    fn offline_status(
        ip: &str,
        query_port: u16,
        game_port: Option<u16>,
        timestamp: String,
        error: String,
    ) -> DayZServerStatus {
        DayZServerStatus {
            server_ip: ip.to_string(),
            query_port,
            game_port,
            is_online: false,
            server_name: String::new(),
            map_name: String::new(),
            players_count: 0,
            max_players: 60,
            bots_count: 0,
            ping_ms: 0,
            environment: "Unknown".to_string(),
            game_version: None,
            queue_size: None,
            last_queried_at: timestamp,
            error: Some(error),
        }
    }
}

fn chrono_iso_now() -> String {
    // Generate ISO8601 without extra heavy chrono dep using standard epoch
    use std::time::SystemTime;
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", dur.as_secs(), dur.subsec_millis())
}
