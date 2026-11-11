import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/**
 * `bytea` is not exported by drizzle-orm 0.39, so declare it explicitly.
 * Stores opaque CRDT snapshots and encrypted secrets.
 */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea'
  },
})

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const documentKind = pgEnum('document_kind', ['doc', 'sheet', 'slides', 'draw'])
export const documentRole = pgEnum('document_role', ['owner', 'editor', 'commenter', 'viewer'])
export const shareAccess = pgEnum('share_access', [
  'restricted',
  'public_view',
  'public_comment',
  'public_edit',
])
export const suggestionStatus = pgEnum('suggestion_status', ['open', 'accepted', 'rejected'])

// ---------------------------------------------------------------------------
// Identity (OIDC subject/account IDs are strings)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(t.expiresAt),
  }),
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerAccountUnique: uniqueIndex('accounts_provider_account_idx').on(
      t.providerId,
      t.accountId,
    ),
    userIdIdx: index('accounts_user_id_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// Workspaces & SSO
// ---------------------------------------------------------------------------

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ssoRequired: boolean('sso_required').notNull().default(false),
    allowedEmailDomains: text('allowed_email_domains')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('workspaces_owner_id_idx').on(t.ownerId),
  }),
)

export const ssoProviders = pgTable(
  'sso_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    issuer: text('issuer').notNull(),
    clientId: text('client_id').notNull(),
    clientSecretEncrypted: bytea('client_secret_encrypted').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`ARRAY['openid','email','profile']::text[]`),
    groupRoleMap: jsonb('group_role_map').notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('sso_providers_workspace_id_idx').on(t.workspaceId),
    workspaceProviderUnique: uniqueIndex('sso_providers_workspace_provider_idx').on(
      t.workspaceId,
      t.providerId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: documentKind('kind').notNull().default('doc'),
    title: text('title').notNull().default('Untitled Document'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    isTemplate: boolean('is_template').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    thumbnail: text('thumbnail'),
    sheetMeta: jsonb('sheet_meta'),
    slidesMeta: jsonb('slides_meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('documents_owner_id_idx').on(t.ownerId),
    workspaceIdx: index('documents_workspace_id_idx').on(t.workspaceId),
    kindIdx: index('documents_kind_idx').on(t.kind),
    updatedAtIdx: index('documents_updated_at_idx').on(t.updatedAt),
  }),
)

export const documentPermissions = pgTable(
  'document_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: documentRole('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentUserUnique: uniqueIndex('document_permissions_doc_user_idx').on(
      t.documentId,
      t.userId,
    ),
    documentIdx: index('document_permissions_document_id_idx').on(t.documentId),
    userIdx: index('document_permissions_user_id_idx').on(t.userId),
  }),
)

export const documentShareLinks = pgTable(
  'document_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    accessType: shareAccess('access_type').notNull().default('restricted'),
    secretToken: text('secret_token').notNull().unique(),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index('document_share_links_document_id_idx').on(t.documentId),
    expiresAtIdx: index('document_share_links_expires_at_idx').on(t.expiresAt),
  }),
)

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: documentKind('kind').notNull().default('doc'),
    title: text('title').notNull(),
    category: text('category').notNull().default('General'),
    description: text('description'),
    previewUrl: text('preview_url'),
    snapshotData: bytea('snapshot_data'),
    isSystem: boolean('is_system').notNull().default(false),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kindIdx: index('document_templates_kind_idx').on(t.kind),
    categoryIdx: index('document_templates_category_idx').on(t.category),
  }),
)

export const documentSnapshots = pgTable(
  'document_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: bigint('version', { mode: 'number' }).notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    loroBinary: bytea('loro_binary').notNull(),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentVersionUnique: uniqueIndex('document_snapshots_doc_version_idx').on(
      t.documentId,
      t.version,
    ),
    documentCreatedIdx: index('document_snapshots_document_created_idx').on(
      t.documentId,
      t.createdAt,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Comments, suggestions, audit
// ---------------------------------------------------------------------------

export const documentComments = pgTable(
  'document_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => documentComments.id, {
      onDelete: 'cascade',
    }),
    anchor: jsonb('anchor'),
    body: text('body').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index('document_comments_document_id_idx').on(t.documentId),
    parentIdx: index('document_comments_parent_id_idx').on(t.parentId),
  }),
)

export const documentSuggestions = pgTable(
  'document_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    status: suggestionStatus('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index('document_suggestions_document_id_idx').on(t.documentId),
  }),
)

export const documentActivityLog = pgTable(
  'document_activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentCreatedIdx: index('document_activity_log_document_created_idx').on(
      t.documentId,
      t.createdAt,
    ),
  }),
)
