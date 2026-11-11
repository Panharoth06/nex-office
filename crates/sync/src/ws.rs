use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use futures_util::{SinkExt, StreamExt};
use office_engine_domain::SyncClaims;
use serde::Deserialize;
use tokio::sync::broadcast::error::RecvError;
use uuid::Uuid;

use crate::rooms::{self, RoomMessage};
use crate::state::AppState;

const MAX_MESSAGE_BYTES: usize = 1024 * 1024;

/// Query parameters accepted by the WebSocket upgrade endpoint.
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    /// Short-lived token minted by the API.
    pub token: String,
}

/// Upgrade an authenticated HTTP request into a room-scoped WebSocket.
///
/// # Errors
///
/// Returns `401 Unauthorized` when the token is missing, malformed, expired, or
/// signed with the wrong key.
pub async fn upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    let claims = office_engine_auth::decode_sync_token(
        state.config.sync_jwt_secret.as_bytes(),
        &query.token,
    )
    .map_err(|err| {
        tracing::warn!(%err, "rejected sync token");
        StatusCode::UNAUTHORIZED
    })?;

    Ok(ws
        .max_message_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| handle_socket(socket, claims, state))
        .into_response())
}

async fn handle_socket(socket: WebSocket, claims: SyncClaims, state: AppState) {
    let SyncClaims {
        doc_id,
        role,
        sub: user,
        ..
    } = claims;
    let client_id = Uuid::new_v4();

    let (sender, mut receiver) = rooms::subscribe(&state.rooms, doc_id);
    let (mut socket_sender, mut socket_receiver) = socket.split();

    let mut send_task = tokio::spawn(async move {
        loop {
            match receiver.recv().await {
                Ok(message) if message.origin == client_id => continue,
                Ok(message) => {
                    if socket_sender
                        .send(Message::Binary(message.payload))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Err(RecvError::Lagged(skipped)) => {
                    tracing::warn!(
                        doc_id = %doc_id,
                        skipped,
                        "sync client lagged; closing connection"
                    );
                    break;
                }
                Err(RecvError::Closed) => break,
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(message)) = socket_receiver.next().await {
            match message {
                Message::Binary(payload) => {
                    if role.can_edit() {
                        let _ = sender.send(RoomMessage {
                            origin: client_id,
                            payload,
                        });
                    } else {
                        tracing::warn!(
                            doc_id = %doc_id,
                            role = %role,
                            "rejected mutation from read-only connection"
                        );
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => {
            recv_task.abort();
            let _ = recv_task.await;
        }
        _ = &mut recv_task => {
            send_task.abort();
            let _ = send_task.await;
        }
    }

    rooms::prune(&state.rooms, doc_id);

    tracing::info!(doc_id = %doc_id, user = %user, "sync connection closed");
}
