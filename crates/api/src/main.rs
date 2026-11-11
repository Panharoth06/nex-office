use std::sync::Arc;

use anyhow::Result;
use office_engine_api::config::Config;
use office_engine_api::state::AppState;
use office_engine_auth::{http_client, RedisSessionStore};
use time::Duration;
use tower_sessions::cookie::SameSite;
use tower_sessions::{Expiry, SessionManagerLayer};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Config::from_env()?;
    let http = http_client()?;

    let oidc_metadata = match &config.oidc {
        Some(oidc) => {
            let metadata = oidc.discover_metadata(&http).await?;
            tracing::info!(
                provider = %oidc.provider_id,
                issuer = %oidc.issuer,
                "OIDC discovery loaded"
            );
            Some(metadata)
        }
        None => {
            tracing::warn!("OIDC_ISSUER is not set; generic OIDC sign-in is disabled");
            None
        }
    };

    let pool = office_engine_storage::connect(&config.database_url, config.db_pool_size).await?;
    office_engine_storage::migrate(&pool).await?;

    let session_store = RedisSessionStore::new(&config.redis_url, "office:session").await?;
    let session_layer = SessionManagerLayer::new(session_store)
        .with_name("office_session")
        .with_http_only(true)
        .with_secure(config.secure_cookies)
        .with_same_site(SameSite::Lax)
        .with_expiry(Expiry::OnInactivity(Duration::days(14)));

    let bind_addr = config.bind_addr.clone();
    let state = AppState {
        config: Arc::new(config),
        pool,
        http,
        oidc_metadata,
    };

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!(addr = %bind_addr, "api listening");

    axum::serve(listener, office_engine_api::app(state, session_layer))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,sqlx=warn".into());

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(err) = tokio::signal::ctrl_c().await {
            tracing::error!(%err, "failed to install Ctrl+C handler");
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(err) => {
                tracing::error!(%err, "failed to install SIGTERM handler");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received; draining connections");
}
