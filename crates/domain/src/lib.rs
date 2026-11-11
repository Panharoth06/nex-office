//! Shared domain types for every Office Engine service.
//!
//! This crate must stay free of I/O, database, and runtime dependencies so it can
//! be compiled into the Wasm client, the Rust API, the sync gateway, and the worker.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// The four product surfaces supported by the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    #[default]
    Doc,
    Sheet,
    Slides,
    Draw,
}

impl DocumentKind {
    pub const ALL: [Self; 4] = [Self::Doc, Self::Sheet, Self::Slides, Self::Draw];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Doc => "doc",
            Self::Sheet => "sheet",
            Self::Slides => "slides",
            Self::Draw => "draw",
        }
    }
}

impl std::str::FromStr for DocumentKind {
    type Err = DomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "doc" => Ok(Self::Doc),
            "sheet" => Ok(Self::Sheet),
            "slides" => Ok(Self::Slides),
            "draw" => Ok(Self::Draw),
            other => Err(DomainError::InvalidDocumentKind(other.to_string())),
        }
    }
}

impl std::fmt::Display for DocumentKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A user's role on a document.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Owner,
    Editor,
    Commenter,
    #[default]
    Viewer,
}

impl Role {
    pub const ALL: [Self; 4] = [Self::Owner, Self::Editor, Self::Commenter, Self::Viewer];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Editor => "editor",
            Self::Commenter => "commenter",
            Self::Viewer => "viewer",
        }
    }

    /// Owners and editors may mutate document content.
    pub fn can_edit(self) -> bool {
        matches!(self, Self::Owner | Self::Editor)
    }

    /// Owners, editors, and commenters may create comments and suggestions.
    pub fn can_comment(self) -> bool {
        !matches!(self, Self::Viewer)
    }

    /// Only owners may manage sharing, transfer ownership, or delete a document.
    pub fn can_manage(self) -> bool {
        matches!(self, Self::Owner)
    }
}

impl std::str::FromStr for Role {
    type Err = DomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "owner" => Ok(Self::Owner),
            "editor" => Ok(Self::Editor),
            "commenter" => Ok(Self::Commenter),
            "viewer" => Ok(Self::Viewer),
            other => Err(DomainError::InvalidRole(other.to_string())),
        }
    }
}

impl std::fmt::Display for Role {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Capability granted by a public share link.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShareAccess {
    Restricted,
    PublicView,
    PublicComment,
    PublicEdit,
}

impl ShareAccess {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Restricted => "restricted",
            Self::PublicView => "public_view",
            Self::PublicComment => "public_comment",
            Self::PublicEdit => "public_edit",
        }
    }

    /// The role a guest receives when opening this link, if the link is public.
    pub fn role(self) -> Option<Role> {
        match self {
            Self::Restricted => None,
            Self::PublicView => Some(Role::Viewer),
            Self::PublicComment => Some(Role::Commenter),
            Self::PublicEdit => Some(Role::Editor),
        }
    }
}

impl std::str::FromStr for ShareAccess {
    type Err = DomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "restricted" => Ok(Self::Restricted),
            "public_view" => Ok(Self::PublicView),
            "public_comment" => Ok(Self::PublicComment),
            "public_edit" => Ok(Self::PublicEdit),
            other => Err(DomainError::InvalidShareAccess(other.to_string())),
        }
    }
}

/// Claims carried by the short-lived token used to authenticate a sync connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncClaims {
    /// Authenticated user ID, or a stable guest ID for public links.
    pub sub: String,
    pub doc_id: Uuid,
    pub role: Role,
    pub exp: usize,
    pub jti: Uuid,
}

/// A document row as exposed to the application layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSummary {
    pub id: Uuid,
    pub kind: DocumentKind,
    pub title: String,
    pub owner_id: String,
    pub workspace_id: Option<Uuid>,
    pub is_template: bool,
    pub thumbnail: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request body for creating a document or instantiating a template.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDocument {
    pub kind: DocumentKind,
    pub title: Option<String>,
    pub workspace_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
}

/// Explicit permission grant for a user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantPermission {
    pub user_id: String,
    pub role: Role,
}

/// Public link configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateShareLink {
    pub access_type: ShareAccess,
    pub password: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("invalid document kind: {0}")]
    InvalidDocumentKind(String),
    #[error("invalid role: {0}")]
    InvalidRole(String),
    #[error("invalid share access: {0}")]
    InvalidShareAccess(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    mod role_capabilities {
        use super::*;

        #[test]
        fn owner_can_edit() {
            assert!(Role::Owner.can_edit());
        }

        #[test]
        fn owner_can_manage() {
            assert!(Role::Owner.can_manage());
        }

        #[test]
        fn editor_can_edit() {
            assert!(Role::Editor.can_edit());
        }

        #[test]
        fn editor_cannot_manage() {
            assert!(!Role::Editor.can_manage());
        }

        #[test]
        fn commenter_can_comment() {
            assert!(Role::Commenter.can_comment());
        }

        #[test]
        fn commenter_cannot_edit() {
            assert!(!Role::Commenter.can_edit());
        }

        #[test]
        fn viewer_cannot_comment() {
            assert!(!Role::Viewer.can_comment());
        }

        #[test]
        fn viewer_cannot_edit() {
            assert!(!Role::Viewer.can_edit());
        }
    }

    mod share_access_roles {
        use super::*;

        #[test]
        fn public_view_grants_viewer() {
            assert_eq!(ShareAccess::PublicView.role(), Some(Role::Viewer));
        }

        #[test]
        fn public_comment_grants_commenter() {
            assert_eq!(ShareAccess::PublicComment.role(), Some(Role::Commenter));
        }

        #[test]
        fn public_edit_grants_editor() {
            assert_eq!(ShareAccess::PublicEdit.role(), Some(Role::Editor));
        }

        #[test]
        fn restricted_grants_no_role() {
            assert_eq!(ShareAccess::Restricted.role(), None);
        }
    }

    mod parsing {
        use std::str::FromStr;

        use super::*;

        #[test]
        fn document_kind_parses_each_identifier() {
            for (value, expected) in [
                ("doc", DocumentKind::Doc),
                ("sheet", DocumentKind::Sheet),
                ("slides", DocumentKind::Slides),
                ("draw", DocumentKind::Draw),
            ] {
                assert_eq!(DocumentKind::from_str(value).ok(), Some(expected));
            }
        }

        #[test]
        fn document_kind_rejects_unknown_identifier() {
            assert!(DocumentKind::from_str("bogus").is_err());
        }

        #[test]
        fn role_parses_each_identifier() {
            for (value, expected) in [
                ("owner", Role::Owner),
                ("editor", Role::Editor),
                ("commenter", Role::Commenter),
                ("viewer", Role::Viewer),
            ] {
                assert_eq!(Role::from_str(value).ok(), Some(expected));
            }
        }

        #[test]
        fn role_rejects_unknown_identifier() {
            assert!(Role::from_str("admin").is_err());
        }

        #[test]
        fn share_access_parses_each_identifier() {
            for (value, expected) in [
                ("restricted", ShareAccess::Restricted),
                ("public_view", ShareAccess::PublicView),
                ("public_comment", ShareAccess::PublicComment),
                ("public_edit", ShareAccess::PublicEdit),
            ] {
                assert_eq!(ShareAccess::from_str(value).ok(), Some(expected));
            }
        }

        #[test]
        fn share_access_rejects_unknown_identifier() {
            assert!(ShareAccess::from_str("public_admin").is_err());
        }
    }
}
