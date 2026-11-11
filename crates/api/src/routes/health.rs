use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;

use crate::state::AppState;

/// Response body for liveness and readiness probes.
#[derive(Debug, Serialize)]
pub struct Health {
    pub status: &'static str,
    pub service: &'static str,
}

pub async fn healthz() -> Json<Health> {
    Json(Health {
        status: "ok",
        service: "api",
    })
}

pub async fn readyz(State(state): State<AppState>) -> Result<Json<Health>, StatusCode> {
    office_engine_storage::ping(&state.pool)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;

    Ok(Json(Health {
        status: "ready",
        service: "api",
    }))
}
