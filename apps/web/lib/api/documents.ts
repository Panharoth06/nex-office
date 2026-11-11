import { errorStatus } from './client'

export type DocumentKind = 'doc' | 'sheet' | 'slides' | 'draw'
export type DocumentRole = 'owner' | 'editor' | 'commenter' | 'viewer'

export interface DocumentSummary {
  id: string
  kind: DocumentKind
  title: string
  owner_id: string
  workspace_id: string | null
  is_template: boolean
  thumbnail: string | null
  created_at: string
  updated_at: string
}

export interface DocumentDetail {
  document: DocumentSummary
  role: DocumentRole
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

export interface SnapshotVersion {
  version: number
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return $fetch<DocumentSummary[]>('/api/documents')
}

export function createDocument(input: {
  kind?: DocumentKind
  title?: string
}): Promise<DocumentSummary> {
  return $fetch<DocumentSummary>('/api/documents', {
    method: 'POST',
    body: { kind: input.kind ?? 'doc', title: input.title },
  })
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return $fetch<DocumentDetail>(`/api/documents/${id}`)
}

export function renameDocument(id: string, title: string): Promise<DocumentSummary> {
  return $fetch<DocumentSummary>(`/api/documents/${id}`, {
    method: 'PATCH',
    body: { title },
  })
}

export function archiveDocument(id: string): Promise<void> {
  return $fetch<void>(`/api/documents/${id}`, { method: 'DELETE' })
}

export async function getSnapshot(id: string): Promise<Uint8Array | null> {
  try {
    const buffer = await $fetch<ArrayBuffer | null>(`/api/documents/${id}/snapshot`, {
      responseType: 'arrayBuffer',
    })
    if (!buffer || buffer.byteLength === 0) return null
    return new Uint8Array(buffer)
  } catch (error) {
    if (errorStatus(error) === 204) return null
    throw error
  }
}

export function saveSnapshot(id: string, bytes: Uint8Array): Promise<SnapshotVersion> {
  const copy = new Uint8Array(bytes)
  return $fetch<SnapshotVersion>(`/api/documents/${id}/snapshot`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Blob([copy.buffer], { type: 'application/octet-stream' }),
  })
}

export function getMe(): Promise<{ user: SessionUser }> {
  return $fetch<{ user: SessionUser }>('/api/auth/me')
}

export function devLogin(input?: { email?: string; name?: string }): Promise<{ user: SessionUser }> {
  return $fetch<{ user: SessionUser }>('/api/auth/dev-login', {
    method: 'POST',
    body: input ?? {},
  })
}

export function logout(): Promise<void> {
  return $fetch<void>('/api/auth/logout', { method: 'POST' })
}
