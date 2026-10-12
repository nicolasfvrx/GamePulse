use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DayZServerStatus {
    pub server_ip: String,
    pub query_port: u16,
    pub game_port: Option<u16>,
    pub is_online: bool,
    pub server_name: String,
    pub map_name: String,
    pub players_count: u8,
    pub max_players: u8,
    pub bots_count: u8,
    pub ping_ms: u64,
    pub environment: String,
    pub game_version: Option<String>,
    pub queue_size: Option<u32>,
    pub last_queried_at: String,
    pub error: Option<String>,
}

#[derive(Clone, Debug)]
pub struct A2SInfoResponse {
    pub protocol: u8,
    pub name: String,
    pub map: String,
    pub folder: String,
    pub game: String,
    pub app_id: u16,
    pub players: u8,
    pub max_players: u8,
    pub bots: u8,
    pub server_type: u8,
    pub environment: u8,
    pub visibility: u8,
    pub vac: u8,
    pub version: Option<String>,
    pub game_port: Option<u16>,
}

#[derive(Debug, thiserror::Error)]
pub enum A2SError {
    #[error("UDP Socket I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Query timed out after {0:?}")]
    Timeout(std::time::Duration),

    #[error("Packet response too short (len: {0})")]
    PacketTooShort(usize),

    #[error("Invalid packet header: expected 0xFFFFFFFF, received {0:?}")]
    InvalidHeader([u8; 4]),

    #[error("Invalid response type: {0:#04x}")]
    InvalidResponseType(u8),

    #[error("Received challenge required from server")]
    ChallengeRequired([u8; 4]),

    #[error("Malformed string in A2S response at offset {0}")]
    MalformedString(usize),
}
