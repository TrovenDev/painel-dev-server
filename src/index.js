import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { filesRouter } from './files.js'
import { verifyToken } from './auth.js'
import { handleTerminalConnection } from './terminal.js'
import { handleChatConnection } from './chat.js'

const PORT = process.env.PORT || 4000
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: ALLOWED_ORIGIN }))
app.use(express.json())

// Toda rota exige o token de sessão do Supabase (mesmo login do Sistema
// Troven) — o painel-dev não tem autenticação própria.
app.use('/api/files', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const user = await verifyToken(token)
  if (!user) return res.status(401).json({ error: 'Não autenticado.' })
  next()
})
app.use('/api/files', filesRouter)

const server = http.createServer(app)

const terminalWss = new WebSocketServer({ noServer: true })
const chatWss = new WebSocketServer({ noServer: true })

server.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const token = url.searchParams.get('token')
  const user = await verifyToken(token)
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  if (url.pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(req, socket, head, (ws) => terminalWss.emit('connection', ws, req))
  } else if (url.pathname === '/ws/chat') {
    chatWss.handleUpgrade(req, socket, head, (ws) => chatWss.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

terminalWss.on('connection', (ws) => handleTerminalConnection(ws))

chatWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const sessionId = url.searchParams.get('session') || 'default'
  handleChatConnection(ws, { sessionId })
})

server.listen(PORT, () => {
  console.log(`painel-dev-server rodando em http://localhost:${PORT} (workspace: ${process.env.WORKSPACE_PATH || process.cwd()})`)
})
