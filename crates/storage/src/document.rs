use std::str::FromStr;

use chrono::{DateTime, Utc};
use office_engine_domain::{Role, ShareAccess};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::error::StorageError;

/// A document row used by the API and dashboard.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DocumentRecord {
    pub id: Uuid,
    pub kind: String,
    pub title: String,
    pub owner_id: String,
    pub workspace_id: Option<Uuid>,
    pub is_template: bool,
    pub thumbnail: Option<String>,
    pub is_archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// The newest snapshot for a document.
#[derive(Debug, Clone, FromRow)]
pub struct SnapshotRecord {
    pub version: i64,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, FromRow)]
struct RoleRow {
    owner_id: String,
    role: Option<String>,
}

/// Resolve a user's role on a document.
///
/// Ownership wins over an explicit permission row. Returns `None` when the
/// document does not exist or the user has no access.
///
/// # Errors
///
/// Returns [`StorageError::InvalidRole`] if the database contains an unknown role
/// value, or a SQL error when the query fails.
pub async fn resolve_document_role(
    pool: &PgPool,
    document_id: Uuid,
    user_id: &str,
) -> Result<Option<Role>, StorageError> {
    let row = sqlx::query_as::<_, RoleRow>(
        r#"
        SELECT d.owner_id, p.role::text AS role
        FROM documents d
        LEFT JOIN document_permissions p
            ON p.document_id = d.id AND p.user_id = $2
        WHERE d.id = $1
        "#,
    )
    .bind(document_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    if row.owner_id == user_id {
        return Ok(Some(Role::Owner));
    }

    let Some(role) = row.role else {
        return Ok(None);
    };

    Role::from_str(&role)
        .map(Some)
        .map_err(|_| StorageError::InvalidRole(role))
}

/// A resolved public share link.
#[derive(Debug, Clone, FromRow)]
pub struct ShareLinkRecord {
    pub document_id: Uuid,
    pub access_type: String,
    pub password_hash: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

impl ShareLinkRecord {
    /// Parse the stored access type.
    ///
    /// # Errors
    ///
    /// Returns [`StorageError::InvalidShareAccess`] for an unknown value.
    pub fn access(&self) -> Result<ShareAccess, StorageError> {
        ShareAccess::from_str(&self.access_type)
            .map_err(|_| StorageError::InvalidShareAccess(self.access_type.clone()))
    }

    /// Whether the link has passed its expiry timestamp.
    pub fn is_expired(&self) -> bool {
        self.expires_at
            .is_some_and(|expires_at| expires_at <= Utc::now())
    }
}

/// Find a share link by its secret token.
///
/// # Errors
///
/// Returns a SQL error when the query fails.
pub async fn find_share_link(
    pool: &PgPool,
    secret_token: &str,
) -> Result<Option<ShareLinkRecord>, StorageError> {
    let link = sqlx::query_as::<_, ShareLinkRecord>(
        r#"
        SELECT document_id, access_type::text AS access_type, password_hash, expires_at
        FROM document_share_links
        WHERE secret_token = $1
        "#,
    )
    .bind(secret_token)
    .fetch_optional(pool)
    .await?;

    Ok(link)
}

/// Whether a document exists, regardless of the caller's access.
///
/// # Errors
///
/// Returns a SQL error when the query fails.
pub async fn document_exists(pool: &PgPool, document_id: Uuid) -> Result<bool, StorageError> {
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)")
            .bind(document_id)
            .fetch_one(pool)
            .await?;

    Ok(exists)
}

/// Create a document owned by `owner_id`.
///
/// # Errors
///
/// Returns a SQL error when the insert fails.
pub async fn create_document(
    pool: &PgPool,
    owner_id: &str,
    title: &str,
    kind: &str,
    workspace_id: Option<Uuid>,
) -> Result<DocumentRecord, StorageError> {
    let document = sqlx::query_as::<_, DocumentRecord>(
        r#"
        INSERT INTO documents (kind, title, owner_id, workspace_id)
        VALUES ($1::document_kind, $2, $3, $4)
        RETURNING id, kind::text AS kind, title, owner_id, workspace_id,
                  is_template, thumbnail, is_archived, created_at, updated_at
        "#,
    )
    .bind(kind)
    .bind(title)
    .bind(owner_id)
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    Ok(document)
}

/// List documents owned by or shared with a user.
///
/// # Errors
///
/// Returns a SQL error when the query fails.
pub async fn list_documents(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<DocumentRecord>, StorageError> {
    let documents = sqlx::query_as::<_, DocumentRecord>(
        r#"
        SELECT d.id, d.kind::text AS kind, d.title, d.owner_id, d.workspace_id,
               d.is_template, d.thumbnail, d.is_archived, d.created_at, d.updated_at
        FROM documents d
        LEFT JOIN document_permissions p
            ON p.document_id = d.id AND p.user_id = $1
        WHERE d.is_archived = FALSE
          AND (d.owner_id = $1 OR p.user_id IS NOT NULL)
        ORDER BY d.updated_at DESC
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(documents)
}

/// Fetch a document by ID without checking access.
///
/// # Errors
///
/// Returns a SQL error when the query fails.
pub async fn get_document(
    pool: &PgPool,
    document_id: Uuid,
) -> Result<Option<DocumentRecord>, StorageError> {
    let document = sqlx::query_as::<_, DocumentRecord>(
        r#"
        SELECT id, kind::text AS kind, title, owner_id, workspace_id,
               is_template, thumbnail, is_archived, created_at, updated_at
        FROM documents
        WHERE id = $1
        "#,
    )
    .bind(document_id)
    .fetch_optional(pool)
    .await?;

    Ok(document)
}

/// Update a document's mutable metadata.
///
/// Passing `None` for a field leaves it unchanged. Archiving is represented by
/// `is_archived = true`; documents are never hard-deleted from this layer.
///
/// # Errors
///
/// Returns [`StorageError::DocumentNotFound`] when the document does not exist,
/// or a SQL error when the update fails.
pub async fn update_document(
    pool: &PgPool,
    document_id: Uuid,
    title: Option<&str>,
    is_archived: Option<bool>,
) -> Result<DocumentRecord, StorageError> {
    let document = sqlx::query_as::<_, DocumentRecord>(
        r#"
        UPDATE documents
        SET title = COALESCE($2, title),
            is_archived = COALESCE($3, is_archived)
        WHERE id = $1
        RETURNING id, kind::text AS kind, title, owner_id, workspace_id,
                  is_template, thumbnail, is_archived, created_at, updated_at
        "#,
    )
    .bind(document_id)
    .bind(title)
    .bind(is_archived)
    .fetch_optional(pool)
    .await?
    .ok_or(StorageError::DocumentNotFound)?;

    Ok(document)
}

/// Load the newest snapshot for a document.
///
/// # Errors
///
/// Returns a SQL error when the query fails.
pub async fn latest_snapshot(
    pool: &PgPool,
    document_id: Uuid,
) -> Result<Option<SnapshotRecord>, StorageError> {
    let snapshot = sqlx::query_as::<_, SnapshotRecord>(
        r#"
        SELECT version, loro_binary AS bytes
        FROM document_snapshots
        WHERE document_id = $1
        ORDER BY version DESC
        LIMIT 1
        "#,
    )
    .bind(document_id)
    .fetch_optional(pool)
    .await?;

    Ok(snapshot)
}

/// Persist a snapshot and return its new version.
///
/// A transaction-scoped advisory lock serializes concurrent writers for the
/// same document across API replicas.
///
/// # Errors
///
/// Returns a SQL error when the transaction fails.
pub async fn save_snapshot(
    pool: &PgPool,
    document_id: Uuid,
    author_id: &str,
    bytes: &[u8],
) -> Result<i64, StorageError> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind(document_id.to_string())
        .execute(&mut *tx)
        .await?;

    let version: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM document_snapshots WHERE document_id = $1",
    )
    .bind(document_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO document_snapshots (document_id, version, author_id, loro_binary)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(document_id)
    .bind(version)
    .bind(author_id)
    .bind(bytes)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE documents SET updated_at = NOW() WHERE id = $1")
        .bind(document_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(version)
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    fn link(access_type: &str, expires_at: Option<DateTime<Utc>>) -> ShareLinkRecord {
        ShareLinkRecord {
            document_id: Uuid::new_v4(),
            access_type: access_type.to_string(),
            password_hash: None,
            expires_at,
        }
    }

    #[test]
    fn public_view_link_parses_as_view_access() {
        assert_eq!(
            link("public_view", None).access().ok(),
            Some(ShareAccess::PublicView)
        );
    }

    #[test]
    fn unknown_access_type_is_rejected() {
        assert!(link("public_admin", None).access().is_err());
    }

    #[test]
    fn link_without_expiry_is_not_expired() {
        assert!(!link("public_view", None).is_expired());
    }

    #[test]
    fn link_past_its_expiry_is_expired() {
        let expires_at = Utc::now() - Duration::seconds(1);
        assert!(link("public_view", Some(expires_at)).is_expired());
    }

    #[test]
    fn link_before_its_expiry_is_not_expired() {
        let expires_at = Utc::now() + Duration::seconds(60);
        assert!(!link("public_view", Some(expires_at)).is_expired());
    }
}
