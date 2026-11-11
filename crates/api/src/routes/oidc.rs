use axum::extract::{Query, State};
use axum::response::{IntoResponse, Redirect, Response};
use openidconnect::core::{CoreAuthenticationFlow, CoreClient};
use openidconnect::{
    AuthorizationCode, CsrfToken, Nonce, PkceCodeChallenge, PkceCodeVerifier, Scope, TokenResponse,
};
use serde::Deserialize;
use tower_sessions::Session;

use crate::error::ApiError;
use crate::session::{
    clear_oidc_handshake, set_user, SessionUser, OIDC_NONCE_KEY, OIDC_STATE_KEY, OIDC_VERIFIER_KEY,
};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

/// Redirect the browser to the configured OIDC provider.
pub async fn start(State(state): State<AppState>, session: Session) -> Result<Response, ApiError> {
    let settings = state.config.oidc.as_ref().ok_or(ApiError::NotFound)?;
    let metadata = state
        .oidc_metadata
        .clone()
        .ok_or_else(|| ApiError::Internal("OIDC metadata is missing".to_string()))?;

    let client = CoreClient::from_provider_metadata(
        metadata,
        settings.client_id(),
        Some(settings.client_secret()),
    )
    .set_redirect_uri(settings.redirect_url()?);
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let mut request = client.authorize_url(
        CoreAuthenticationFlow::AuthorizationCode,
        CsrfToken::new_random,
        Nonce::new_random,
    );
    for scope in settings
        .scopes
        .iter()
        .filter(|scope| scope.as_str() != "openid")
    {
        request = request.add_scope(Scope::new(scope.clone()));
    }

    let (auth_url, csrf_state, nonce) = request.set_pkce_challenge(pkce_challenge).url();

    session.insert(OIDC_STATE_KEY, csrf_state.secret()).await?;
    session.insert(OIDC_NONCE_KEY, nonce.secret()).await?;
    session
        .insert(OIDC_VERIFIER_KEY, pkce_verifier.secret())
        .await?;

    Ok(Redirect::to(auth_url.as_str()).into_response())
}

/// Exchange the authorization code, validate the ID token, and create a session.
pub async fn callback(
    State(state): State<AppState>,
    session: Session,
    Query(query): Query<CallbackQuery>,
) -> Result<Response, ApiError> {
    let settings = state.config.oidc.as_ref().ok_or(ApiError::NotFound)?;
    let metadata = state
        .oidc_metadata
        .clone()
        .ok_or_else(|| ApiError::Internal("OIDC metadata is missing".to_string()))?;

    let stored_state: Option<String> = session.get(OIDC_STATE_KEY).await?;
    let stored_nonce: Option<String> = session.get(OIDC_NONCE_KEY).await?;
    let stored_verifier: Option<String> = session.get(OIDC_VERIFIER_KEY).await?;

    if stored_state.as_deref() != Some(query.state.as_str()) {
        return Err(ApiError::BadRequest("invalid OIDC state".to_string()));
    }

    let nonce = Nonce::new(
        stored_nonce.ok_or_else(|| ApiError::BadRequest("missing OIDC nonce".to_string()))?,
    );
    let verifier = PkceCodeVerifier::new(
        stored_verifier.ok_or_else(|| ApiError::BadRequest("missing PKCE verifier".to_string()))?,
    );

    let client = CoreClient::from_provider_metadata(
        metadata,
        settings.client_id(),
        Some(settings.client_secret()),
    )
    .set_redirect_uri(settings.redirect_url()?);
    let token_response = client
        .exchange_code(AuthorizationCode::new(query.code))
        .map_err(|err| {
            tracing::error!(%err, "OIDC client is missing the token endpoint");
            ApiError::Internal("OIDC client configuration error".to_string())
        })?
        .set_pkce_verifier(verifier)
        .request_async(&state.http)
        .await
        .map_err(|err| {
            tracing::warn!(%err, "OIDC token exchange failed");
            ApiError::Unauthorized
        })?;

    let id_token = token_response.id_token().ok_or(ApiError::Unauthorized)?;
    let claims = id_token
        .claims(&client.id_token_verifier(), &nonce)
        .map_err(|err| {
            tracing::warn!(%err, "OIDC ID token verification failed");
            ApiError::Unauthorized
        })?;

    let subject = claims.subject().as_str();
    let email = claims
        .email()
        .map(|email| email.as_str().to_string())
        .ok_or(ApiError::Forbidden)?;

    if !claims.email_verified().unwrap_or(false) {
        return Err(ApiError::Forbidden);
    }

    let name = claims
        .name()
        .and_then(|name| name.get(None))
        .map(|name| name.as_str().to_string())
        .unwrap_or_else(|| email.clone());
    let image = claims
        .picture()
        .and_then(|picture| picture.get(None))
        .map(|picture| picture.as_str().to_string());

    let user = office_engine_storage::find_or_create_oidc_user(
        &state.pool,
        &settings.provider_id,
        subject,
        &email,
        true,
        &name,
        image.as_deref(),
    )
    .await?;

    session.cycle_id().await?;
    set_user(
        &session,
        &SessionUser {
            id: user.id,
            email: user.email,
            name: user.name,
        },
    )
    .await?;
    clear_oidc_handshake(&session).await?;

    Ok(Redirect::to(&format!("{}/", state.config.web_origin)).into_response())
}
