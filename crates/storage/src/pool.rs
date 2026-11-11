use std::str::FromStr;
use std::time::Duration;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;

/// Connection settings shared by the API, sync gateway, and worker.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    pub database_url: String,
    pub max_connections: u32,
}

impl StorageConfig {
    /// Load connection settings from the environment.
    ///
    /// # Errors
    ///
    /// Returns [`std::env::VarError`] when `DATABASE_URL` is missing.
    pub fn from_env() -> Result<Self, std::env::VarError> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?,
            max_connections: std::env::var("DB_POOL_SIZE")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(20),
        })
    }
}

/// Open a bounded connection pool.
///
/// Statement caching is disabled because production traffic runs through PgBouncer
/// in transaction-pooling mode, where server-side prepared statements are unsafe.
pub async fn connect(database_url: &str, max_connections: u32) -> Result<PgPool, sqlx::Error> {
    let options = PgConnectOptions::from_str(database_url)?.statement_cache_capacity(0);

    PgPoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .connect_with(options)
        .await
}

/// Apply migrations owned by `crates/storage`.
///
/// Only the API binary or CI may call this. Sync and worker must never migrate.
pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}

/// Lightweight readiness probe.
pub async fn ping(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}
