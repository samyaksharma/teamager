import { WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { getDocumentPermissions } from '../utils/permissions'

// y-websocket utils for Y.js document sync
// @ts-ignore - no type declarations for this subpath
import { setupWSConnection } from 'y-websocket/bin/utils'

function parseCookieToken(cookies?: string): string | null {
  if (!cookies) return null
  for (const cookie of cookies.split(';')) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === 'accessToken') return rest.join('=')
  }
  return null
}

export function setupYjsServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)

    // Only handle /yjs/* paths — let Socket.IO or others pass through
    if (!url.pathname.startsWith('/yjs/')) return

    const documentId = url.pathname.slice('/yjs/'.length)
    if (!documentId) {
      socket.destroy()
      return
    }

    try {
      // Auth: read JWT from cookie or query param
      const token = parseCookieToken(request.headers.cookie) || url.searchParams.get('token')
      if (!token) {
        socket.destroy()
        return
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      const userId = decoded.userId

      // Check document permissions
      const permissions = await getDocumentPermissions(documentId, userId)
      if (!permissions.canView) {
        socket.destroy()
        return
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        setupWSConnection(ws, request, { docName: documentId })
      })
    } catch (error) {
      console.error('Y.js WebSocket auth failed:', error)
      socket.destroy()
    }
  })

  console.log('Y.js WebSocket server ready on /yjs/*')
  return wss
}
