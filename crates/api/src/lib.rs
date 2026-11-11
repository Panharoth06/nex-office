//! Office Engine HTTP API.

pub mod config;
pub mod error;
pub mod routes;
pub mod session;
pub mod state;

use axum::http::{header, HeaderValue, Method};
use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_sessions::{SessionManagerLayer, SessionStore};

use crate::state::AppState;

/// Build the API router with health checks, CORS, sessions, and request tracing.
pub fn app<S>(state: AppState, session_layer: SessionManagerLayer<S>) -> Router
where
    S: SessionStore + Clone,
{
    let cors = build_cors(&state.config.web_origin);

    Router::new()
        .route("/healthz", get(routes::health::healthz))
        .route("/readyz", get(routes::health::readyz))
        .nest("/api", routes::api_router())
        .layer(session_layer)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

fn build_cors(origin: &str) -> CorsLayer {
    let allowed = match origin.parse::<HeaderValue>() {
        Ok(value) => value,
        Err(err) => {
            tracing::warn!(%err, origin, "invalid WEB_ORIGIN; falling back to localhost");
            HeaderValue::from_static("http://localhost:3000")
        }
    };

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
}
