//! PostgreSQL access layer for every Office Engine service.

pub mod document;
pub mod error;
pub mod pool;
pub mod user;

pub use document::{
    create_document, document_exists, find_share_link, get_document, latest_snapshot,
    list_documents, resolve_document_role, save_snapshot, update_document, DocumentRecord,
    ShareLinkRecord, SnapshotRecord,
};
pub use error::StorageError;
pub use pool::{connect, migrate, ping, StorageConfig};
pub use user::{find_or_create_dev_user, find_or_create_oidc_user, UserRecord};
