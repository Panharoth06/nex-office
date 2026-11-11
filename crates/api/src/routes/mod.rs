pub mod auth;
pub mod documents;
pub mod health;
pub mod oidc;
pub mod sync_token;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

/// Routes mounted under `/api`.
pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::healthz))
        .nest("/auth", auth::router())
        .nest("/sync", sync_token::router())
        .merge(documents::router())
}
