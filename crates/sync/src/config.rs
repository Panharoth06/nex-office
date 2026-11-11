use anyhow::{Context, Result};

/// Runtime configuration for the sync gateway.
#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: String,
    pub sync_jwt_secret: String,
}

impl Config {
    /// Load configuration from the environment.
    ///
    /// # Errors
    ///
    /// Returns an error when `SYNC_JWT_SECRET` is missing or empty.
    pub fn from_env() -> Result<Self> {
        let sync_jwt_secret = optional_env("SYNC_JWT_SECRET")
            .context("missing required environment variable: SYNC_JWT_SECRET")?;

        Ok(Self {
            bind_addr: optional_env("SYNC_BIND").unwrap_or_else(|| "0.0.0.0:8081".to_string()),
            sync_jwt_secret,
        })
    }
}

fn optional_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
