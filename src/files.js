import { Router } from 'express'
import fs from 'fs/promises'
import { resolveProjectRoot, resolveSafe } from './workspace.js'

export const filesRouter = Router()

// Toda rota aqui exige ?project=<nome> — o explorador de arquivos sempre
// opera dentro de um projeto específico, nunca no workspace inteiro.
function resolveProjectDir(req) {
  const project = req.query.project
  if (!project) throw new Error('Parâmetro "project" é obrigatório.')
  return resolveProjectRoot(project)
}

// GET /api/files?project=sistema-estoque&path=src/pages -> lista os itens daquela pasta
filesRouter.get('/', async (req, res) => {
  try {
    const projectDir = resolveProjectDir(req)
    const dir = resolveSafe(projectDir, req.query.path)
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const items = entries
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    res.json({ path: req.query.path || '', items })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/files/content?project=sistema-estoque&path=src/App.jsx -> conteúdo de um arquivo (só leitura)
filesRouter.get('/content', async (req, res) => {
  try {
    const projectDir = resolveProjectDir(req)
    const filePath = resolveSafe(projectDir, req.query.path)
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) throw new Error('Não é um arquivo.')
    if (stat.size > 1_000_000) throw new Error('Arquivo grande demais pra visualizar (limite 1MB).')
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ path: req.query.path, content })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
