use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::time::{interval, sleep};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, warn};

const GATEWAY_URL: &str = "wss://gateway.discord.gg/?v=10&encoding=json";

pub struct DiscordGatewayClient {
    token: String,
    presence_rx: UnboundedReceiver<String>,
}

impl DiscordGatewayClient {
    pub fn new(token: String, presence_rx: UnboundedReceiver<String>) -> Self {
        Self { token, presence_rx }
    }

    /// Runs the Discord Gateway loop, reconnecting on disconnection.
    pub async fn run(mut self, bot_name: String) {
        let mut backoff = Duration::from_secs(2);

        loop {
            info!("[{}] Connecting to Discord Gateway v10...", bot_name);

            match connect_async(GATEWAY_URL).await {
                Ok((ws_stream, _)) => {
                    info!("[{}] Connected to Discord Gateway!", bot_name);
                    backoff = Duration::from_secs(2); // reset backoff

                    let (mut write, mut read) = ws_stream.split();
                    let mut heartbeat_interval_ms: Option<u64> = None;

                    // 1. Wait for Opcode 10 Hello
                    while let Some(msg) = read.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                    if parsed["op"].as_i64() == Some(10) {
                                        if let Some(hb_interval) = parsed["d"]["heartbeat_interval"].as_u64() {
                                            heartbeat_interval_ms = Some(hb_interval);
                                            debug!("[{}] Received Hello! Heartbeat interval: {}ms", bot_name, hb_interval);
                                            break;
                                        }
                                    }
                                }
                            }
                            Ok(Message::Close(frame)) => {
                                warn!("[{}] Received Close frame during Hello: {:?}", bot_name, frame);
                                break;
                            }
                            Err(e) => {
                                warn!("[{}] Error waiting for Hello: {}", bot_name, e);
                                break;
                            }
                            _ => {}
                        }
                    }

                    let hb_ms = match heartbeat_interval_ms {
                        Some(ms) => ms,
                        None => {
                            warn!("[{}] Did not receive Hello opcode, reconnecting...", bot_name);
                            sleep(backoff).await;
                            continue;
                        }
                    };

                    // 2. Send Identify Opcode 2
                    let identify_payload = json!({
                        "op": 2,
                        "d": {
                            "token": self.token,
                            "intents": 0,
                            "properties": {
                                "os": "windows",
                                "browser": "gamepulse-network",
                                "device": "gamepulse-network"
                            }
                        }
                    });

                    if let Err(e) = write.send(Message::Text(identify_payload.to_string())).await {
                        error!("[{}] Failed to send Identify: {}", bot_name, e);
                        sleep(backoff).await;
                        continue;
                    }

                    info!("[{}] Identify sent! Gateway session established.", bot_name);

                    // 3. Main event loop: Heartbeats, incoming presence updates, reading messages
                    let mut hb_timer = interval(Duration::from_millis(hb_ms));
                    let mut last_sequence: Option<i64> = None;

                    loop {
                        tokio::select! {
                            // Tick Heartbeat
                            _ = hb_timer.tick() => {
                                let hb_packet = json!({
                                    "op": 1,
                                    "d": last_sequence
                                });
                                if let Err(e) = write.send(Message::Text(hb_packet.to_string())).await {
                                    warn!("[{}] Heartbeat send failed: {}", bot_name, e);
                                    break;
                                }
                                debug!("[{}] Gateway Heartbeat sent", bot_name);
                            }

                            // New Presence text to push
                            Some(presence_text) = self.presence_rx.recv() => {
                                debug!("[{}] Updating Discord presence: {}", bot_name, presence_text);
                                let presence_payload = json!({
                                    "op": 3,
                                    "d": {
                                        "since": null,
                                        "activities": [
                                            {
                                                "name": presence_text,
                                                "type": 0 // 0 = Playing ("Joue à ...")
                                            }
                                        ],
                                        "status": "online",
                                        "afk": false
                                    }
                                });

                                if let Err(e) = write.send(Message::Text(presence_payload.to_string())).await {
                                    warn!("[{}] Failed to update presence: {}", bot_name, e);
                                    break;
                                }
                            }

                            // Incoming Gateway messages
                            msg = read.next() => {
                                match msg {
                                    Some(Ok(Message::Text(text))) => {
                                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                                            if let Some(s) = v["s"].as_i64() {
                                                last_sequence = Some(s);
                                            }
                                            if v["op"].as_i64() == Some(1) {
                                                // Server requested immediate heartbeat
                                                let hb = json!({ "op": 1, "d": last_sequence });
                                                let _ = write.send(Message::Text(hb.to_string())).await;
                                            }
                                        }
                                    }
                                    Some(Ok(Message::Ping(data))) => {
                                        let _ = write.send(Message::Pong(data)).await;
                                    }
                                    Some(Ok(Message::Close(frame))) => {
                                        warn!("[{}] Discord Gateway closed connection: {:?}", bot_name, frame);
                                        break;
                                    }
                                    Some(Err(e)) => {
                                        warn!("[{}] WebSocket error: {}", bot_name, e);
                                        break;
                                    }
                                    None => {
                                        warn!("[{}] WebSocket stream ended", bot_name);
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("[{}] Failed to connect to Discord Gateway: {}", bot_name, e);
                }
            }

            warn!("[{}] Reconnecting to Discord in {:?}...", bot_name, backoff);
            sleep(backoff).await;
            backoff = (backoff * 2).min(Duration::from_secs(60));
        }
    }
}
