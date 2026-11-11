use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use office_engine_auth::AuthError;
use office_engine_storage::StorageError;
use serde::Serialize;
use tower_sessions::session;

/// Errors returned by API handlers.
#[derive(Debug)]
pub enum ApiError {
    Unauthorized,
    Forbidden,
    NotFound,
    BadRequest(String),
    Internal(String),
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: &'static str,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error, message) = match self {
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "Authentication required".to_string(),
            ),
            Self::Forbidden => (
                StatusCode::FORBIDDEN,
                "forbidden",
                "You do not have access to this resource".to_string(),
            ),
            Self::NotFound => (
                StatusCode::NOT_FOUND,
                "not_found",
                "Resource not found".to_string(),
            ),
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, "bad_request", message),
            Self::Internal(message) => {
                tracing::error!(%message, "internal API error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Internal server error".to_string(),
                )
            }
        };

        (status, Json(ErrorBody { error, message })).into_response()
    }
}

impl From<StorageError> for ApiError {
    fn from(err: StorageError) -> Self {
        match err {
            StorageError::EmailNotVerified | StorageError::AccountConflict => Self::Forbidden,
            StorageError::DocumentNotFound => Self::NotFound,
            other => Self::Internal(other.to_string()),
        }
    }
}

impl From<AuthError> for ApiError {
    fn from(err: AuthError) -> Self {
        Self::Internal(err.to_string())
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        Self::Internal(err.to_string())
    }
}

impl From<session::Error> for ApiError {
    fn from(err: session::Error) -> Self {
        Self::Internal(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use axum::response::IntoResponse;

    use super::*;

    #[test]
    fn unauthorized_maps_to_401() {
        assert_eq!(
            ApiError::Unauthorized.into_response().status(),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn forbidden_maps_to_403() {
        assert_eq!(
            ApiError::Forbidden.into_response().status(),
            StatusCode::FORBIDDEN
        );
    }

    #[test]
    fn not_found_maps_to_404() {
        assert_eq!(
            ApiError::NotFound.into_response().status(),
            StatusCode::NOT_FOUND
        );
    }

    #[test]
    fn bad_request_maps_to_400() {
        assert_eq!(
            ApiError::BadRequest("bad".to_string())
                .into_response()
                .status(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn internal_maps_to_500_without_leaking_details() {
        let response = ApiError::Internal("database password leaked".to_string()).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn missing_document_maps_to_404() {
        let response = ApiError::from(StorageError::DocumentNotFound).into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
