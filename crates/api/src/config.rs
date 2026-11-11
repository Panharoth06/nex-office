use anyhow::{Context, Result};

use office_engine_auth::OidcSettings;

/// Runtime configuration for the API binary.
#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: String,
    pub database_url: String,
    pub db_pool_size: u32,
    pub redis_url: String,
    pub web_origin: String,
    pub secure_cookies: bool,
    pub sync_jwt_secret: String,
    pub oidc: Option<OidcSettings>,
    /// When true, `POST /api/auth/dev-login` can mint a local session.
    /// Never enabled by default; intended for local development and tests.
    pub dev_auth: bool,
}

impl Config {
    /// Load configuration from the environment.
    ///
    /// # Errors
    ///
    /// Returns an error when `DATABASE_URL` or `SYNC_JWT_SECRET` is missing, or
    /// when an optional value is present but malformed.
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            bind_addr: env_or("API_BIND", "0.0.0.0:8080"),
            database_url: env_required("DATABASE_URL")?,
            db_pool_size: env_or("DB_POOL_SIZE", "20")
                .parse()
                .context("DB_POOL_SIZE must be a positive integer")?,
            redis_url: env_or("REDIS_URL", "redis://127.0.0.1:6379"),
            web_origin: env_or("WEB_ORIGIN", "http://localhost:3000"),
            secure_cookies: env_bool("SESSION_SECURE_COOKIES", false),
            sync_jwt_secret: env_required("SYNC_JWT_SECRET")?,
            oidc: OidcSettings::from_env()?,
            dev_auth: env_bool("DEV_AUTH", false),
        })
    }
}

fn env_or(name: &str, fallback: &str) -> String {
    optional_env(name).unwrap_or_else(|| fallback.to_string())
}

fn env_required(name: &'static str) -> Result<String> {
    optional_env(name).with_context(|| format!("missing required environment variable: {name}"))
}

fn env_bool(name: &str, fallback: bool) -> bool {
    optional_env(name)
        .map(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(fallback)
}

fn optional_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
