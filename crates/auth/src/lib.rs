//! Authentication primitives: OIDC discovery, sync tokens, and sessions.

pub mod error;
pub mod jwt;
pub mod oidc;
pub mod session;

pub use error::AuthError;
pub use jwt::{decode_sync_token, encode_sync_token, issue_sync_claims, sync_token_ttl_secs};
pub use oidc::{http_client, CoreClient, CoreProviderMetadata, HttpClient, OidcSettings};
pub use session::RedisSessionStore;
