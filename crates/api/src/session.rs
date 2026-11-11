use serde::{Deserialize, Serialize};
use tower_sessions::Session;

use crate::error::ApiError;

/// Session key holding the signed-in user.
pub const USER_KEY: &str = "user";
/// Session key holding the OIDC `state` value.
pub const OIDC_STATE_KEY: &str = "oidc_state";
/// Session key holding the OIDC `nonce` value.
pub const OIDC_NONCE_KEY: &str = "oidc_nonce";
/// Session key holding the PKCE verifier.
pub const OIDC_VERIFIER_KEY: &str = "oidc_verifier";
/// Session key holding a stable guest identity for public share links.
pub const GUEST_ID_KEY: &str = "guest_id";

/// Minimal user identity stored in the session cookie's server-side record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub id: String,
    pub email: String,
    pub name: String,
}

pub async fn current_user(
    session: &Session,
) -> Result<Option<SessionUser>, tower_sessions::session::Error> {
    session.get(USER_KEY).await
}

/// Return the signed-in user or an authentication error.
///
/// # Errors
///
/// Returns [`ApiError::Unauthorized`] when no user is stored in the session.
pub async fn require_user(session: &Session) -> Result<SessionUser, ApiError> {
    current_user(session).await?.ok_or(ApiError::Unauthorized)
}

pub async fn set_user(
    session: &Session,
    user: &SessionUser,
) -> Result<(), tower_sessions::session::Error> {
    session.insert(USER_KEY, user).await
}

/// Remove the temporary OIDC handshake values after a successful callback.
pub async fn clear_oidc_handshake(session: &Session) -> Result<(), tower_sessions::session::Error> {
    for key in [OIDC_STATE_KEY, OIDC_NONCE_KEY, OIDC_VERIFIER_KEY] {
        session.remove::<String>(key).await?;
    }

    Ok(())
}

/// Return a stable guest identity for public share-link sessions.
pub async fn guest_id(session: &Session) -> Result<String, tower_sessions::session::Error> {
    if let Some(id) = session.get::<String>(GUEST_ID_KEY).await? {
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    session.insert(GUEST_ID_KEY, &id).await?;
    Ok(id)
}
