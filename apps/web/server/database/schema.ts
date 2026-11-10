import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core'

// 1. User & Authentication Tables (Better-Auth Standard)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// 2. Documents Table
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('Untitled Document'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  thumbnail: text('thumbnail'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// 3. User Document Permissions (Direct Sharing: Owner, Editor, Commenter, Viewer)
export const documentPermissions = sqliteTable('document_permissions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'commenter', 'viewer'] }).notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// 4. Shareable Links (General Access: Restricted vs Anyone with link)
export const documentShareLinks = sqliteTable('document_share_links', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  accessType: text('access_type', {
    enum: ['restricted', 'public_view', 'public_comment', 'public_edit'],
  }).notNull().default('restricted'),
  secretToken: text('secret_token').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// 5. Templates Gallery (System Curated + User Custom Templates)
export const documentTemplates = sqliteTable('document_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull().default('General'), // Resume, Proposal, Notes, Letter
  description: text('description'),
  previewUrl: text('preview_url'),
  snapshotData: blob('snapshot_data'), // Initial Loro binary snapshot
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// 6. Revision History & Snapshots
export const documentSnapshots = sqliteTable('document_snapshots', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  version: integer('version').notNull(),
  authorId: text('author_id').references(() => users.id),
  loroBinary: blob('loro_binary').notNull(), // Complete Loro CRDT snapshot
  summary: text('summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
