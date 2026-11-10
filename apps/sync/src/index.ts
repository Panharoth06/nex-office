import { WebSocketServer, WebSocket } from 'ws'

const PORT = Number(process.env.SYNC_PORT) || 8080

interface ClientConnection {
  ws: WebSocket
  docId: string
  userId: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  presence?: {
    cursor?: { x: number; y: number }
    color?: string
    name?: string
  }
}

const rooms = new Map<string, Set<ClientConnection>>()

const wss = new WebSocketServer({ port: PORT })

console.log(`[Sync Server] Listening on ws://localhost:${PORT}`)

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const docId = url.searchParams.get('docId') || 'default'
  const token = url.searchParams.get('token') || ''
  const role = (url.searchParams.get('role') as any) || 'viewer'
  const userId = url.searchParams.get('userId') || `guest-${Math.random().toString(36).substring(7)}`

  const client: ClientConnection = {
    ws,
    docId,
    userId,
    role,
  }

  if (!rooms.has(docId)) {
    rooms.set(docId, new Set())
  }
  rooms.get(docId)!.add(client)

  console.log(`[Sync Server] User ${userId} (${role}) joined doc: ${docId}`)

  ws.on('message', (data: Buffer) => {
    // Viewer cannot broadcast mutation patches
    if (client.role === 'viewer') {
      return
    }

    // Broadcast mutation / presence delta to all other peers in the room
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
    console.log(`[Sync Server] User ${userId} disconnected from doc: ${docId}`)
  })
})
