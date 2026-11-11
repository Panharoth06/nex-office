use std::sync::Arc;

use office_engine_auth::{CoreProviderMetadata, HttpClient};
use sqlx::PgPool;

use crate::config::Config;

/// Shared state cloned into every axum handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub pool: PgPool,
    pub http: HttpClient,
    pub oidc_metadata: Option<CoreProviderMetadata>,
}
