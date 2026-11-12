use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;

use crate::error::ApiError;
use crate::routes::oidc;
use crate::session::{current_user, set_user, SessionUser};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub user: SessionUser,
}

#[derive(Debug, Serialize)]
pub struct AuthConfigResponse {
    pub oidc_enabled: bool,
    pub dev_auth: bool,
}

#[derive(Debug, Deserialize, Default)]
pub struct DevLoginRequest {
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Authentication routes mounted under `/api/auth`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/config", get(config))
        .route("/me", get(me))
        .route("/logout", post(logout))
        .route("/dev-login", post(dev_login))
        .route("/oidc/start", get(oidc::start))
        .route("/oidc/callback", get(oidc::callback))
}

/// Return which sign-in methods this deployment supports.
pub async fn config(State(state): State<AppState>) -> Json<AuthConfigResponse> {
    Json(AuthConfigResponse {
        oidc_enabled: state.config.oidc.is_some(),
        dev_auth: state.config.dev_auth,
    })
}

/// Return the currently signed-in user.
pub async fn me(session: Session) -> Result<Json<MeResponse>, ApiError> {
    let user = current_user(&session)
        .await?
        .ok_or(ApiError::Unauthorized)?;

    Ok(Json(MeResponse { user }))
}

/// Destroy the current session.
pub async fn logout(session: Session) -> Result<StatusCode, ApiError> {
    if session.id().is_some() {
        session.flush().await?;
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Create a local session when `DEV_AUTH` is enabled.
///
/// This route is disabled unless the deployment explicitly opts in. It exists
/// for local development and browser tests, not for production sign-in.
pub async fn dev_login(
    State(state): State<AppState>,
    session: Session,
    Json(request): Json<DevLoginRequest>,
) -> Result<Json<MeResponse>, ApiError> {
    if !state.config.dev_auth {
        return Err(ApiError::NotFound);
    }

    let email = request
        .email
        .unwrap_or_else(|| "dev@office.local".to_string())
        .trim()
        .to_lowercase();

    if !email.contains('@') {
        return Err(ApiError::BadRequest("invalid email".to_string()));
    }

    let name = request
        .name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Dev User".to_string());

    let user = office_engine_storage::find_or_create_dev_user(&state.pool, &email, &name).await?;
    let session_user = SessionUser {
        id: user.id,
        email: user.email,
        name: user.name,
    };

    session.cycle_id().await?;
    set_user(&session, &session_user).await?;

    Ok(Json(MeResponse { user: session_user }))
}
