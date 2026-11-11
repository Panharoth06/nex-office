use std::sync::Arc;

use crate::config::Config;
use crate::rooms::Rooms;

/// Shared state cloned into WebSocket handlers.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub rooms: Rooms,
}
