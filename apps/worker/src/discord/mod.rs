pub mod bot;
pub mod gateway;
pub mod manager;

pub use bot::{format_presence, spawn_bot, ActiveBotHandle};
pub use gateway::DiscordGatewayClient;
pub use manager::BotManager;
