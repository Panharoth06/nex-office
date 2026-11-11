use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use office_engine_domain::Role;
use serde::{Deserialize, Serialize};
use tower_sessions::Session;
use uuid::Uuid;

use crate::error::ApiError;
use crate::session::current_user;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SyncTokenRequest {
    pub doc_id: Uuid,
    pub share_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SyncTokenResponse {
    pub token: String,
    pub expires_in: usize,
    pub doc_id: Uuid,
    pub role: Role,
}

/// `POST /api/sync/token`
pub fn router() -> Router<AppState> {
    Router::new().route("/token", post(issue))
}

/// Mint a short-lived, document-scoped token for the sync gateway.
///
/// The role is always resolved server-side: a session user's direct permission
/// wins, otherwise a valid public share link is required.
pub async fn issue(
    State(state): State<AppState>,
    session: Session,
    Json(request): Json<SyncTokenRequest>,
) -> Result<Json<SyncTokenResponse>, ApiError> {
    let user = current_user(&session).await?;
    let mut subject = None;
    let mut role = None;

    if let Some(user) = &user {
        if let Some(resolved) =
            office_engine_storage::resolve_document_role(&state.pool, request.doc_id, &user.id)
                .await?
        {
            subject = Some(user.id.clone());
            role = Some(resolved);
        }
    }

    if role.is_none() {
        if let Some(share_token) = &request.share_token {
            let link = office_engine_storage::find_share_link(&state.pool, share_token)
                .await?
                .ok_or(ApiError::Forbidden)?;

            if link.document_id != request.doc_id || link.is_expired() {
                return Err(ApiError::Forbidden);
            }

            if link.password_hash.is_some() {
                return Err(ApiError::BadRequest(
                    "password-protected share links are not supported yet".to_string(),
                ));
            }

            let public_role = link.access()?.role().ok_or(ApiError::Forbidden)?;
            subject = Some(format!(
                "guest:{}",
                crate::session::guest_id(&session).await?
            ));
            role = Some(public_role);
        }
    }

    let (subject, role) = match (subject, role) {
        (Some(subject), Some(role)) => (subject, role),
        _ => return Err(ApiError::Forbidden),
    };

    let claims = office_engine_auth::issue_sync_claims(subject, request.doc_id, role)?;
    let token =
        office_engine_auth::encode_sync_token(state.config.sync_jwt_secret.as_bytes(), &claims)?;

    Ok(Json(SyncTokenResponse {
        token,
        expires_in: office_engine_auth::sync_token_ttl_secs(),
        doc_id: request.doc_id,
        role,
    }))
}
