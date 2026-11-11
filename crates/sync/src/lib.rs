//! Office Engine WebSocket sync gateway.

pub mod config;
pub mod rooms;
pub mod state;
pub mod ws;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

/// Build the sync gateway router.
///
/// Exposes a liveness probe and the authenticated WebSocket upgrade endpoint.
pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/ws", get(ws::upgrade))
        .with_state(state)
}

async fn healthz() -> &'static str {
    "ok"
}
