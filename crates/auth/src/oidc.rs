use openidconnect::reqwest;
use openidconnect::{ClientId, ClientSecret, IssuerUrl, RedirectUrl};

use crate::error::AuthError;

pub use openidconnect::core::{CoreClient, CoreProviderMetadata};
pub use openidconnect::reqwest::Client as HttpClient;

/// Build a redirect-free HTTP client for discovery, token exchange, and JWKS.
///
/// # Errors
///
/// Returns [`AuthError::OidcConfig`] if the client cannot be constructed.
pub fn http_client() -> Result<HttpClient, AuthError> {
    HttpClient::builder()
        // Following redirects during discovery opens the client up to SSRF.
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|err| AuthError::OidcConfig(err.to_string()))
}

/// OIDC settings loaded from the environment.
///
/// `OIDC_ISSUER` is the only required switch: when it is absent, the deployment
/// runs without a generic OIDC provider (password or other providers may still be
/// configured). When present, the remaining values are mandatory.
#[derive(Debug, Clone)]
pub struct OidcSettings {
    pub provider_id: String,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_url: String,
    pub scopes: Vec<String>,
}

impl OidcSettings {
    /// Load settings from the environment.
    ///
    /// Returns `Ok(None)` when `OIDC_ISSUER` is not set, which disables generic
    /// OIDC sign-in without failing startup.
    ///
    /// # Errors
    ///
    /// Returns [`AuthError::MissingEnv`] when the issuer is set but a required
    /// companion value is absent.
    pub fn from_env() -> Result<Option<Self>, AuthError> {
        let Some(issuer) = optional("OIDC_ISSUER") else {
            return Ok(None);
        };
        let issuer = issuer.trim_end_matches('/').to_string();

        let scopes = optional("OIDC_SCOPES")
            .map(|raw| {
                raw.split(',')
                    .map(str::trim)
                    .filter(|scope| !scope.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>()
            })
            .filter(|scopes| !scopes.is_empty())
            .unwrap_or_else(|| vec!["openid".into(), "email".into(), "profile".into()]);

        Ok(Some(Self {
            provider_id: optional("OIDC_PROVIDER_ID").unwrap_or_else(|| "oidc".to_string()),
            issuer,
            client_id: required("OIDC_CLIENT_ID")?,
            client_secret: required("OIDC_CLIENT_SECRET")?,
            redirect_url: required("OIDC_REDIRECT_URL")?,
            scopes,
        }))
    }

    /// The standard discovery document URL for the configured issuer.
    pub fn discovery_url(&self) -> String {
        format!(
            "{}/.well-known/openid-configuration",
            self.issuer.trim_end_matches('/')
        )
    }

    /// Fetch and validate the provider discovery document.
    ///
    /// The returned metadata is used by `crates/api` to build a `CoreClient` with
    /// PKCE, a redirect URI, and JWKS-backed ID-token verification. Call once at
    /// startup and reuse the metadata rather than rediscovering per request.
    ///
    /// # Errors
    ///
    /// Returns [`AuthError::OidcDiscovery`] when discovery fails.
    pub async fn discover_metadata(
        &self,
        http_client: &HttpClient,
    ) -> Result<CoreProviderMetadata, AuthError> {
        let issuer = IssuerUrl::new(self.issuer.clone())
            .map_err(|e| AuthError::OidcConfig(e.to_string()))?;

        CoreProviderMetadata::discover_async(issuer, http_client)
            .await
            .map_err(|e| AuthError::OidcDiscovery(e.to_string()))
    }

    /// The client identifier registered with the provider.
    pub fn client_id(&self) -> ClientId {
        ClientId::new(self.client_id.clone())
    }

    /// The client secret registered with the provider.
    pub fn client_secret(&self) -> ClientSecret {
        ClientSecret::new(self.client_secret.clone())
    }

    /// The redirect URI registered with the provider.
    ///
    /// # Errors
    ///
    /// Returns [`AuthError::OidcConfig`] when the configured URL is invalid.
    pub fn redirect_url(&self) -> Result<RedirectUrl, AuthError> {
        RedirectUrl::new(self.redirect_url.clone())
            .map_err(|e| AuthError::OidcConfig(e.to_string()))
    }
}

fn optional(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn required(name: &'static str) -> Result<String, AuthError> {
    optional(name).ok_or(AuthError::MissingEnv(name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_url_avoids_double_slashes() {
        let settings = OidcSettings {
            provider_id: "oidc".into(),
            issuer: "https://idp.example.com/".into(),
            client_id: "client".into(),
            client_secret: "secret".into(),
            redirect_url: "http://localhost:8080/api/auth/oidc/callback".into(),
            scopes: vec!["openid".into()],
        };

        assert_eq!(
            settings.discovery_url(),
            "https://idp.example.com/.well-known/openid-configuration"
        );
    }
}
