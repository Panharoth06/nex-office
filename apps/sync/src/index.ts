import { WebSocketServer, WebSocket } from 'ws'
import { jwtVerify } from 'jose'

// Legacy Node sync gateway. The canonical implementation is `crates/sync`.
// This file remains as a reference until the Rust gateway reaches feature parity,
// and it enforces the same server-signed-token contract.

const PORT = Number(process.env.SYNC_PORT) || 8081
const secretValue = process.env.SYNC_JWT_SECRET

if (!secretValue) {
  throw new Error('SYNC_JWT_SECRET is required')
}

const secret = new TextEncoder().encode(secretValue)

type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

interface SyncClaims {
  sub: string
  doc_id: string
  role: Role
  exp: number
  jti: string
}

interface ClientConnection {
  ws: WebSocket
  docId: string
  userId: string
  role: Role
  presence?: {
    cursor?: { x: number; y: number }
    color?: string
    name?: string
  }
}

const rooms = new Map<string, Set<ClientConnection>>()

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: 1024 * 1024,
})

console.log(`[Sync Server] Listening on ws://localhost:${PORT}`)

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const token = url.searchParams.get('token')

  if (!token) {
    ws.close(4401, 'missing token')
    return
  }

  let claims: SyncClaims
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    claims = payload as unknown as SyncClaims
  } catch {
    ws.close(4401, 'invalid token')
    return
  }

  const docId = url.searchParams.get('docId') || claims.doc_id
  if (docId !== claims.doc_id) {
    ws.close(4403, 'token/document mismatch')
    return
  }

  const allowedRoles: Role[] = ['owner', 'editor', 'commenter', 'viewer']
  if (!allowedRoles.includes(claims.role)) {
    ws.close(4401, 'invalid role')
    return
  }

  const client: ClientConnection = {
    ws,
    docId,
    userId: claims.sub,
    role: claims.role,
  }

  if (!rooms.has(docId)) {
    rooms.set(docId, new Set())
  }
  rooms.get(docId)!.add(client)

  console.log(`[Sync Server] User ${client.userId} (${client.role}) joined doc: ${docId}`)

  const canEdit = client.role === 'owner' || client.role === 'editor'

  ws.on('message', (data: Buffer) => {
    if (!canEdit) {
      console.warn(
        `[Sync Server] Rejected mutation from ${client.userId} (${client.role}) on doc ${docId}`,
      )
      return
    }

    const room = rooms.get(docId)
    if (room) {
      for (const peer of room) {
        if (peer !== client && peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.send(data)
        }
      }
    }
  })

  ws.on('close', () => {
    const room = rooms.get(docId)
    if (room) {
      room.delete(client)
      if (room.size === 0) {
        rooms.delete(docId)
      }
    }
    console.log(`[Sync Server] User ${client.userId} disconnected from doc: ${docId}`)
  })
})
