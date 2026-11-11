use std::sync::Arc;

use bytes::Bytes;
use dashmap::DashMap;
use tokio::sync::broadcast;
use uuid::Uuid;

/// A broadcast payload tagged with the connection that produced it.
///
/// `Bytes` keeps fan-out cheap: cloning the message across subscribers shares
/// the underlying buffer instead of copying it per peer.
#[derive(Debug, Clone)]
pub struct RoomMessage {
    pub origin: Uuid,
    pub payload: Bytes,
}

/// Per-document broadcast channels.
///
/// In M1 this is backed by Redis pub/sub so replicas can fan out without
/// sticky sessions. Keeping the registry behind an `Arc` lets axum handlers
/// clone a cheap handle instead of the channel map itself.
pub type Rooms = Arc<DashMap<Uuid, broadcast::Sender<RoomMessage>>>;

const ROOM_CAPACITY: usize = 256;

/// Create an empty room registry.
pub fn new_rooms() -> Rooms {
    Arc::new(DashMap::new())
}

/// Subscribe to a document room, creating it if necessary.
///
/// The subscription is created while the map entry is locked, so a concurrent
/// [`prune`] cannot remove the room between lookup and `subscribe`.
pub fn subscribe(
    rooms: &Rooms,
    doc_id: Uuid,
) -> (
    broadcast::Sender<RoomMessage>,
    broadcast::Receiver<RoomMessage>,
) {
    let entry = rooms
        .entry(doc_id)
        .or_insert_with(|| broadcast::channel(ROOM_CAPACITY).0);

    (entry.clone(), entry.subscribe())
}

/// Drop a room when its last subscriber disconnects.
///
/// `remove_if` performs the check and removal under the same shard lock, so a
/// newly connected peer cannot have its sender swapped out underneath it.
pub fn prune(rooms: &Rooms, doc_id: Uuid) {
    rooms.remove_if(&doc_id, |_, sender| sender.receiver_count() == 0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscribe_creates_a_room_on_first_connection() {
        let rooms = new_rooms();
        let doc_id = Uuid::new_v4();

        let (sender, _receiver) = subscribe(&rooms, doc_id);

        assert_eq!(sender.receiver_count(), 1);
    }

    #[test]
    fn prune_removes_an_empty_room() {
        let rooms = new_rooms();
        let doc_id = Uuid::new_v4();

        let (sender, receiver) = subscribe(&rooms, doc_id);
        drop(sender);
        drop(receiver);
        prune(&rooms, doc_id);

        assert!(!rooms.contains_key(&doc_id));
    }

    #[tokio::test]
    async fn room_messages_carry_the_origin() {
        let rooms = new_rooms();
        let doc_id = Uuid::new_v4();
        let origin = Uuid::new_v4();
        let (sender, mut receiver) = subscribe(&rooms, doc_id);

        sender
            .send(RoomMessage {
                origin,
                payload: Bytes::from_static(b"update"),
            })
            .expect("receiver is still subscribed");
        let message = receiver.recv().await.expect("message should be delivered");

        assert_eq!(message.origin, origin);
    }
}
