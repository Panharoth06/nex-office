-- 0001_init.sql — Office Engine core schema (PostgreSQL 16+)

CREATE TYPE document_kind AS ENUM ('doc', 'sheet', 'slides', 'draw');
CREATE TYPE document_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');
CREATE TYPE share_access AS ENUM ('restricted', 'public_view', 'public_comment', 'public_edit');
CREATE TYPE suggestion_status AS ENUM ('open', 'accepted', 'rejected');

-- ---------------------------------------------------------------------------
-- Identity (OIDC subject/account IDs are strings)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    image           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Live sessions are stored in Redis by tower-sessions. This table is reserved
-- for durable session audit and revocation metadata.
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    token       TEXT NOT NULL,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sessions_token_unique UNIQUE (token)
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE accounts (
    id                        TEXT PRIMARY KEY,
    account_id                TEXT NOT NULL,
    provider_id               TEXT NOT NULL,
    user_id                   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token              TEXT,
    refresh_token             TEXT,
    id_token                  TEXT,
    access_token_expires_at   TIMESTAMPTZ,
    refresh_token_expires_at  TIMESTAMPTZ,
    scope                     TEXT,
    password                  TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounts_provider_account_idx UNIQUE (provider_id, account_id)
);

CREATE INDEX accounts_user_id_idx ON accounts(user_id);

-- ---------------------------------------------------------------------------
-- Workspaces and SSO
-- ---------------------------------------------------------------------------

CREATE TABLE workspaces (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    slug                  TEXT NOT NULL,
    owner_id              TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    sso_required          BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_email_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspaces_slug_unique UNIQUE (slug)
);

CREATE INDEX workspaces_owner_id_idx ON workspaces(owner_id);

CREATE TABLE sso_providers (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_id              TEXT NOT NULL,
    issuer                   TEXT NOT NULL,
    client_id                TEXT NOT NULL,
    client_secret_encrypted  BYTEA NOT NULL,
    scopes                   TEXT[] NOT NULL DEFAULT ARRAY['openid', 'email', 'profile'],
    group_role_map           JSONB NOT NULL DEFAULT '{}'::JSONB,
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sso_providers_workspace_provider_idx UNIQUE (workspace_id, provider_id)
);

CREATE INDEX sso_providers_workspace_id_idx ON sso_providers(workspace_id);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          document_kind NOT NULL DEFAULT 'doc',
    title         TEXT NOT NULL DEFAULT 'Untitled Document',
    owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    workspace_id  UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    is_template   BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
    thumbnail     TEXT,
    sheet_meta    JSONB,
    slides_meta   JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_owner_id_idx ON documents(owner_id);
CREATE INDEX documents_workspace_id_idx ON documents(workspace_id);
CREATE INDEX documents_kind_idx ON documents(kind);
CREATE INDEX documents_updated_at_idx ON documents(updated_at DESC);

CREATE TABLE document_permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         document_role NOT NULL DEFAULT 'viewer',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_permissions_doc_user_idx UNIQUE (document_id, user_id)
);

CREATE INDEX document_permissions_user_id_idx ON document_permissions(user_id);
CREATE INDEX document_permissions_document_id_idx ON document_permissions(document_id);

CREATE TABLE document_share_links (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    access_type    share_access NOT NULL DEFAULT 'restricted',
    secret_token   TEXT NOT NULL,
    password_hash  TEXT,
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_share_links_secret_token_unique UNIQUE (secret_token)
);

CREATE INDEX document_share_links_document_id_idx ON document_share_links(document_id);
CREATE INDEX document_share_links_expires_at_idx ON document_share_links(expires_at);

CREATE TABLE document_templates (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind           document_kind NOT NULL DEFAULT 'doc',
    title          TEXT NOT NULL,
    category       TEXT NOT NULL DEFAULT 'General',
    description    TEXT,
    preview_url    TEXT,
    snapshot_data  BYTEA,
    is_system      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_templates_kind_idx ON document_templates(kind);
CREATE INDEX document_templates_category_idx ON document_templates(category);

CREATE TABLE document_snapshots (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version      BIGINT NOT NULL,
    author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    loro_binary  BYTEA NOT NULL,
    summary      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_snapshots_doc_version_idx UNIQUE (document_id, version)
);

CREATE INDEX document_snapshots_document_created_idx
    ON document_snapshots(document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Comments, suggestions, audit
-- ---------------------------------------------------------------------------

CREATE TABLE document_comments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    parent_id    UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    anchor       JSONB,
    body         TEXT NOT NULL,
    resolved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_comments_document_id_idx ON document_comments(document_id);
CREATE INDEX document_comments_parent_id_idx ON document_comments(parent_id);

CREATE TABLE document_suggestions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    kind         TEXT NOT NULL,
    payload      JSONB NOT NULL,
    status       suggestion_status NOT NULL DEFAULT 'open',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_suggestions_document_id_idx ON document_suggestions(document_id);

CREATE TABLE document_activity_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
    actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_activity_log_document_created_idx
    ON document_activity_log(document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER accounts_set_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workspaces_set_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sso_providers_set_updated_at
    BEFORE UPDATE ON sso_providers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER documents_set_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_comments_set_updated_at
    BEFORE UPDATE ON document_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
