use thiserror::Error;

/// Failure modes for authentication and session operations.
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing environment variable: {0}")]
    MissingEnv(&'static str),

    #[error("invalid sync token: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("system clock is before the unix epoch")]
    Clock,

    #[error("OIDC discovery failed: {0}")]
    OidcDiscovery(String),

    #[error("invalid OIDC configuration: {0}")]
    OidcConfig(String),
}
