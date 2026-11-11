use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use time::OffsetDateTime;
use tower_sessions::session::{Id, Record};
use tower_sessions::session_store::{
    Error as SessionStoreError, Result as SessionStoreResult, SessionStore,
};

/// Redis-backed session store for `tower-sessions`.
///
/// Sessions are stored as JSON with a TTL derived from the record's expiry date.
/// Redis is the source of truth, so any API replica can serve any session.
#[derive(Clone)]
pub struct RedisSessionStore {
    connection: ConnectionManager,
    prefix: String,
}

impl std::fmt::Debug for RedisSessionStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RedisSessionStore")
            .field("prefix", &self.prefix)
            .finish_non_exhaustive()
    }
}

impl RedisSessionStore {
    /// Connect to Redis and build a store.
    ///
    /// # Errors
    ///
    /// Returns [`redis::RedisError`] when the URL is invalid or Redis is
    /// unreachable.
    pub async fn new(
        redis_url: &str,
        prefix: impl Into<String>,
    ) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let connection = client.get_connection_manager().await?;

        Ok(Self {
            connection,
            prefix: prefix.into(),
        })
    }

    fn key(&self, session_id: &Id) -> String {
        format!("{}:{}", self.prefix, session_id)
    }

    async fn write(&self, record: &Record, only_if_absent: bool) -> SessionStoreResult<bool> {
        let value =
            serde_json::to_vec(record).map_err(|err| SessionStoreError::Encode(err.to_string()))?;

        let ttl = (record.expiry_date - OffsetDateTime::now_utc())
            .whole_seconds()
            .max(1) as u64;

        let key = self.key(&record.id);
        let mut connection = self.connection.clone();

        if only_if_absent {
            let stored: Option<String> = redis::cmd("SET")
                .arg(&key)
                .arg(value)
                .arg("EX")
                .arg(ttl)
                .arg("NX")
                .query_async(&mut connection)
                .await
                .map_err(|err| SessionStoreError::Backend(err.to_string()))?;

            Ok(stored.is_some())
        } else {
            let _: () = connection
                .set_ex(&key, value, ttl)
                .await
                .map_err(|err| SessionStoreError::Backend(err.to_string()))?;

            Ok(true)
        }
    }
}

#[async_trait]
impl SessionStore for RedisSessionStore {
    async fn create(&self, record: &mut Record) -> SessionStoreResult<()> {
        for _ in 0..3 {
            if self.write(record, true).await? {
                return Ok(());
            }
            record.id = Id::default();
        }

        Err(SessionStoreError::Backend(
            "failed to allocate a unique session id".to_string(),
        ))
    }

    async fn save(&self, record: &Record) -> SessionStoreResult<()> {
        self.write(record, false).await?;
        Ok(())
    }

    async fn load(&self, session_id: &Id) -> SessionStoreResult<Option<Record>> {
        let mut connection = self.connection.clone();
        let value: Option<Vec<u8>> = connection
            .get(self.key(session_id))
            .await
            .map_err(|err| SessionStoreError::Backend(err.to_string()))?;

        let Some(value) = value else {
            return Ok(None);
        };

        let record: Record = serde_json::from_slice(&value)
            .map_err(|err| SessionStoreError::Decode(err.to_string()))?;

        if record.expiry_date <= OffsetDateTime::now_utc() {
            self.delete(session_id).await?;
            return Ok(None);
        }

        Ok(Some(record))
    }

    async fn delete(&self, session_id: &Id) -> SessionStoreResult<()> {
        let mut connection = self.connection.clone();
        let _: i64 = connection
            .del(self.key(session_id))
            .await
            .map_err(|err| SessionStoreError::Backend(err.to_string()))?;
        Ok(())
    }
}
