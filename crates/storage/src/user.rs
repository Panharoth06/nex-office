use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::StorageError;

/// A user row returned by identity lookups.
#[derive(Debug, Clone, FromRow)]
pub struct UserRecord {
    pub id: String,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
}

/// Find the user linked to an OIDC subject, creating or linking one as needed.
///
/// Existing accounts are matched by `(provider_id, account_id)`. If no account is
/// linked, an existing user is matched by email **only when the provider reports
/// a verified email**; otherwise the operation is rejected to prevent account
/// takeover.
///
/// # Errors
///
/// Returns [`StorageError::EmailNotVerified`] when linking would require an
/// unverified email, or a SQL error when the transaction fails.
pub async fn find_or_create_oidc_user(
    pool: &PgPool,
    provider_id: &str,
    subject: &str,
    email: &str,
    email_verified: bool,
    name: &str,
    image: Option<&str>,
) -> Result<UserRecord, StorageError> {
    let mut tx = pool.begin().await?;

    if let Some(user) = find_by_account(&mut tx, provider_id, subject).await? {
        tx.commit().await?;
        return Ok(user);
    }

    if let Some(user) = find_by_email(&mut tx, email).await? {
        if !email_verified {
            return Err(StorageError::EmailNotVerified);
        }

        link_account(&mut tx, provider_id, subject, &user.id).await?;
        tx.commit().await?;
        return Ok(user);
    }

    let user = create_user(&mut tx, email, email_verified, name, image).await?;
    link_account(&mut tx, provider_id, subject, &user.id).await?;
    tx.commit().await?;

    Ok(user)
}

/// Find or create a local development user.
///
/// This is used only by the `DEV_AUTH` login route. It never links an external
/// identity and never runs when `DEV_AUTH` is disabled.
///
/// # Errors
///
/// Returns a SQL error when the transaction fails.
pub async fn find_or_create_dev_user(
    pool: &PgPool,
    email: &str,
    name: &str,
) -> Result<UserRecord, StorageError> {
    let mut tx = pool.begin().await?;

    if let Some(user) = find_by_email(&mut tx, email).await? {
        tx.commit().await?;
        return Ok(user);
    }

    let user = create_user(&mut tx, email, true, name, None).await?;
    tx.commit().await?;

    Ok(user)
}

async fn find_by_account(
    tx: &mut Transaction<'_, Postgres>,
    provider_id: &str,
    subject: &str,
) -> Result<Option<UserRecord>, StorageError> {
    let user = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT u.id, u.name, u.email, u.email_verified, u.image
        FROM accounts a
        JOIN users u ON u.id = a.user_id
        WHERE a.provider_id = $1 AND a.account_id = $2
        "#,
    )
    .bind(provider_id)
    .bind(subject)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(user)
}

async fn find_by_email(
    tx: &mut Transaction<'_, Postgres>,
    email: &str,
) -> Result<Option<UserRecord>, StorageError> {
    let user = sqlx::query_as::<_, UserRecord>(
        "SELECT id, name, email, email_verified, image FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(user)
}

async fn create_user(
    tx: &mut Transaction<'_, Postgres>,
    email: &str,
    email_verified: bool,
    name: &str,
    image: Option<&str>,
) -> Result<UserRecord, StorageError> {
    let user = sqlx::query_as::<_, UserRecord>(
        r#"
        INSERT INTO users (id, name, email, email_verified, image)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, email_verified, image
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(name)
    .bind(email)
    .bind(email_verified)
    .bind(image)
    .fetch_one(&mut **tx)
    .await?;

    Ok(user)
}

async fn link_account(
    tx: &mut Transaction<'_, Postgres>,
    provider_id: &str,
    subject: &str,
    user_id: &str,
) -> Result<(), StorageError> {
    sqlx::query(
        r#"
        INSERT INTO accounts (id, account_id, provider_id, user_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (provider_id, account_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(subject)
    .bind(provider_id)
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    let linked_user: Option<String> = sqlx::query_scalar(
        "SELECT user_id FROM accounts WHERE provider_id = $1 AND account_id = $2",
    )
    .bind(provider_id)
    .bind(subject)
    .fetch_optional(&mut **tx)
    .await?;

    if linked_user.as_deref() != Some(user_id) {
        return Err(StorageError::AccountConflict);
    }

    Ok(())
}
