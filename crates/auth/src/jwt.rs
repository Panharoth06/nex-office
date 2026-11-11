use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use office_engine_domain::{Role, SyncClaims};
use uuid::Uuid;

use crate::error::AuthError;

/// Maximum lifetime of a WebSocket authentication token.
pub const SYNC_TOKEN_TTL_SECS: usize = 300;

/// Build claims for a new sync token.
///
/// # Errors
///
/// Returns [`AuthError::Clock`] if the system clock is before the Unix epoch.
pub fn issue_sync_claims(sub: String, doc_id: Uuid, role: Role) -> Result<SyncClaims, AuthError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AuthError::Clock)?
        .as_secs() as usize;

    Ok(SyncClaims {
        sub,
        doc_id,
        role,
        exp: now + SYNC_TOKEN_TTL_SECS,
        jti: Uuid::new_v4(),
    })
}

/// Sign a sync token with the shared HS256 secret.
pub fn encode_sync_token(secret: &[u8], claims: &SyncClaims) -> Result<String, AuthError> {
    let header = Header::new(Algorithm::HS256);
    let key = EncodingKey::from_secret(secret);
    Ok(jsonwebtoken::encode(&header, claims, &key)?)
}

/// Verify a sync token and return its claims.
///
/// Signature, algorithm, and expiry are all validated. Callers must still check
/// that `doc_id` matches the room being joined.
pub fn decode_sync_token(secret: &[u8], token: &str) -> Result<SyncClaims, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 5;

    let data =
        jsonwebtoken::decode::<SyncClaims>(token, &DecodingKey::from_secret(secret), &validation)?;

    Ok(data.claims)
}

/// The maximum lifetime, in seconds, of a sync token.
pub fn sync_token_ttl_secs() -> usize {
    SYNC_TOKEN_TTL_SECS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_token_round_trip_preserves_claims() {
        let secret = b"test-secret";
        let doc_id = Uuid::new_v4();
        let claims = issue_sync_claims("user-1".into(), doc_id, Role::Editor)
            .expect("system clock should be after the unix epoch");

        let token = encode_sync_token(secret, &claims).expect("token should encode");
        let decoded = decode_sync_token(secret, &token).expect("token should decode");

        assert_eq!(
            (decoded.sub, decoded.doc_id, decoded.role),
            ("user-1".to_string(), doc_id, Role::Editor)
        );
    }

    #[test]
    fn sync_token_rejects_a_different_secret() {
        let claims = issue_sync_claims("user-1".into(), Uuid::new_v4(), Role::Viewer)
            .expect("system clock should be after the unix epoch");
        let token = encode_sync_token(b"secret-a", &claims).expect("token should encode");

        assert!(decode_sync_token(b"secret-b", &token).is_err());
    }
}
