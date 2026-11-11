use thiserror::Error;

/// Errors returned by the storage layer.
#[derive(Debug, Error)]
pub enum StorageError {
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),

    #[error("email is not verified by the identity provider")]
    EmailNotVerified,

    #[error("identity provider account is already linked to another user")]
    AccountConflict,

    #[error("invalid role stored in the database: {0}")]
    InvalidRole(String),

    #[error("invalid share access stored in the database: {0}")]
    InvalidShareAccess(String),

    #[error("document not found")]
    DocumentNotFound,
}
