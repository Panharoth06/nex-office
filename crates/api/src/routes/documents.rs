use std::str::FromStr;

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use office_engine_domain::{DocumentKind, DocumentSummary, Role};
use office_engine_storage::DocumentRecord;
use serde::{Deserialize, Serialize};
use tower_sessions::Session;
use uuid::Uuid;

use crate::error::ApiError;
use crate::session::require_user;
use crate::state::AppState;

/// Maximum accepted Loro snapshot size.
const MAX_SNAPSHOT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Deserialize)]
pub struct CreateDocumentRequest {
    pub kind: DocumentKind,
    pub title: Option<String>,
    pub workspace_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocumentRequest {
    pub title: Option<String>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct DocumentDetail {
    pub document: DocumentSummary,
    pub role: Role,
}

#[derive(Debug, Serialize)]
pub struct SnapshotVersion {
    pub version: i64,
}

/// Document routes mounted under `/api`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/documents", get(list).post(create))
        .route(
            "/documents/{id}",
            get(get_one).patch(update).delete(archive),
        )
        .route(
            "/documents/{id}/snapshot",
            get(get_snapshot).put(put_snapshot),
        )
        .layer(DefaultBodyLimit::max(MAX_SNAPSHOT_BYTES))
}

/// `GET /api/documents`
pub async fn list(
    State(state): State<AppState>,
    session: Session,
) -> Result<Json<Vec<DocumentSummary>>, ApiError> {
    let user = require_user(&session).await?;
    let documents = office_engine_storage::list_documents(&state.pool, &user.id).await?;

    let summaries = documents
        .into_iter()
        .map(to_summary)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(summaries))
}

/// `POST /api/documents`
pub async fn create(
    State(state): State<AppState>,
    session: Session,
    Json(request): Json<CreateDocumentRequest>,
) -> Result<(StatusCode, Json<DocumentSummary>), ApiError> {
    let user = require_user(&session).await?;

    if request.workspace_id.is_some() {
        return Err(ApiError::BadRequest(
            "workspace selection is not available yet".to_string(),
        ));
    }

    let title =
        normalise_title(request.title).unwrap_or_else(|| default_title(request.kind).to_string());

    let document = office_engine_storage::create_document(
        &state.pool,
        &user.id,
        &title,
        request.kind.as_str(),
        None,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(to_summary(document)?)))
}

/// `GET /api/documents/{id}`
pub async fn get_one(
    State(state): State<AppState>,
    session: Session,
    Path(document_id): Path<Uuid>,
) -> Result<Json<DocumentDetail>, ApiError> {
    let user = require_user(&session).await?;
    let role = role_for(&state, document_id, &user.id).await?;
    let document = office_engine_storage::get_document(&state.pool, document_id)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(DocumentDetail {
        document: to_summary(document)?,
        role,
    }))
}

/// `PATCH /api/documents/{id}`
pub async fn update(
    State(state): State<AppState>,
    session: Session,
    Path(document_id): Path<Uuid>,
    Json(request): Json<UpdateDocumentRequest>,
) -> Result<Json<DocumentSummary>, ApiError> {
    let user = require_user(&session).await?;
    let role = role_for(&state, document_id, &user.id).await?;

    if request.title.is_none() && request.is_archived.is_none() {
        return Err(ApiError::BadRequest("no fields to update".to_string()));
    }

    if request.title.is_some() && !role.can_edit() {
        return Err(ApiError::Forbidden);
    }

    if request.is_archived.is_some() && !role.can_manage() {
        return Err(ApiError::Forbidden);
    }

    let title_requested = request.title.is_some();
    let title = normalise_title(request.title);
    if title_requested && title.is_none() {
        return Err(ApiError::BadRequest("title cannot be empty".to_string()));
    }

    let document = office_engine_storage::update_document(
        &state.pool,
        document_id,
        title.as_deref(),
        request.is_archived,
    )
    .await?;

    Ok(Json(to_summary(document)?))
}

/// `DELETE /api/documents/{id}` — archives the document.
pub async fn archive(
    State(state): State<AppState>,
    session: Session,
    Path(document_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user = require_user(&session).await?;
    let role = role_for(&state, document_id, &user.id).await?;

    if !role.can_manage() {
        return Err(ApiError::Forbidden);
    }

    office_engine_storage::update_document(&state.pool, document_id, None, Some(true)).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/documents/{id}/snapshot`
pub async fn get_snapshot(
    State(state): State<AppState>,
    session: Session,
    Path(document_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let user = require_user(&session).await?;
    let _role = role_for(&state, document_id, &user.id).await?;

    let snapshot = office_engine_storage::latest_snapshot(&state.pool, document_id).await?;
    let Some(snapshot) = snapshot else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };

    let mut response = snapshot.bytes.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );

    Ok(response)
}

/// `PUT /api/documents/{id}/snapshot`
pub async fn put_snapshot(
    State(state): State<AppState>,
    session: Session,
    Path(document_id): Path<Uuid>,
    body: Bytes,
) -> Result<Json<SnapshotVersion>, ApiError> {
    let user = require_user(&session).await?;
    let role = role_for(&state, document_id, &user.id).await?;

    if !role.can_edit() {
        return Err(ApiError::Forbidden);
    }

    if body.is_empty() {
        return Err(ApiError::BadRequest("snapshot is empty".to_string()));
    }

    let version =
        office_engine_storage::save_snapshot(&state.pool, document_id, &user.id, &body).await?;

    Ok(Json(SnapshotVersion { version }))
}

async fn role_for(state: &AppState, document_id: Uuid, user_id: &str) -> Result<Role, ApiError> {
    office_engine_storage::resolve_document_role(&state.pool, document_id, user_id)
        .await?
        .ok_or(ApiError::NotFound)
}

fn normalise_title(title: Option<String>) -> Option<String> {
    title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn default_title(kind: DocumentKind) -> &'static str {
    match kind {
        DocumentKind::Doc => "Untitled Document",
        DocumentKind::Sheet => "Untitled Spreadsheet",
        DocumentKind::Slides => "Untitled Presentation",
        DocumentKind::Draw => "Untitled Drawing",
    }
}

fn to_summary(record: DocumentRecord) -> Result<DocumentSummary, ApiError> {
    let kind =
        DocumentKind::from_str(&record.kind).map_err(|err| ApiError::Internal(err.to_string()))?;

    Ok(DocumentSummary {
        id: record.id,
        kind,
        title: record.title,
        owner_id: record.owner_id,
        workspace_id: record.workspace_id,
        is_template: record.is_template,
        thumbnail: record.thumbnail,
        created_at: record.created_at,
        updated_at: record.updated_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_titles_follow_the_document_kind() {
        assert_eq!(default_title(DocumentKind::Doc), "Untitled Document");
        assert_eq!(default_title(DocumentKind::Sheet), "Untitled Spreadsheet");
        assert_eq!(default_title(DocumentKind::Slides), "Untitled Presentation");
        assert_eq!(default_title(DocumentKind::Draw), "Untitled Drawing");
    }

    #[test]
    fn titles_are_trimmed_and_blank_titles_are_rejected() {
        assert_eq!(
            normalise_title(Some("  Quarterly plan  ".to_string())),
            Some("Quarterly plan".to_string())
        );
        assert_eq!(normalise_title(Some("   ".to_string())), None);
        assert_eq!(normalise_title(None), None);
    }
}
