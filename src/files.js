import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'

const WORKSPACE_PATH = path.resolve(process.env.WORKSPACE_PATH || process.cwd())

// Garante que o caminho pedido nunca escape do workspace (ex: "../../etc/passwd"
// ou um caminho absoluto tentando substituir o workspace inteiro).
function resolveSafe(relativePath) {
  const target = path.resolve(WORKSPACE_PATH, relativePath || '.')
  const withSep = WORKSPACE_PATH.endsWith(path.sep) ? WORKSPACE_PATH : WORKSPACE_PATH + path.sep
  if (target !== WORKSPACE_PATH && !target.startsWith(withSep)) {
    throw new Error('Caminho fora do workspace.')
  }
  return target
}

export const filesRouter = Router()

// GET /api/files?path=src/pages -> lista os itens daquela pasta
filesRouter.get('/', async (req, res) => {
  try {
    const dir = resolveSafe(req.query.path)
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const items = entries
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    res.json({ path: req.query.path || '', items })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/files/content?path=src/App.jsx -> conteúdo de um arquivo (só leitura)
filesRouter.get('/content', async (req, res) => {
  try {
    const filePath = resolveSafe(req.query.path)
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) throw new Error('Não é um arquivo.')
    if (stat.size > 1_000_000) throw new Error('Arquivo grande demais pra visualizar (limite 1MB).')
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ path: req.query.path, content })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
