import { Router } from 'express'
import fs from 'fs/promises'
import { WORKSPACE_PATH, isValidProjectName, resolveProjectRoot } from './workspace.js'

export const projectsRouter = Router()

// GET /api/projects -> lista as pastas de primeiro nível do workspace, cada
// uma representando um projeto.
projectsRouter.get('/', async (req, res) => {
  try {
    const entries = await fs.readdir(WORKSPACE_PATH, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory())
    const projects = await Promise.all(
      dirs.map(async (e) => {
        const stat = await fs.stat(resolveProjectRoot(e.name))
        return { name: e.name, createdAt: stat.birthtime.toISOString() }
      })
    )
    projects.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ items: projects })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/projects { name } -> cria uma nova pasta de projeto no workspace.
projectsRouter.post('/', async (req, res) => {
  try {
    const name = req.body?.name
    if (!isValidProjectName(name)) {
      return res.status(400).json({
        error: 'Nome inválido. Use só letras, números, "-" e "_" (até 64 caracteres).',
      })
    }

    const projectPath = resolveProjectRoot(name)
    const exists = await fs
      .stat(projectPath)
      .then(() => true)
      .catch(() => false)
    if (exists) {
      return res.status(409).json({ error: 'Já existe um projeto com esse nome.' })
    }

    await fs.mkdir(projectPath)
    const stat = await fs.stat(projectPath)
    res.status(201).json({ name, createdAt: stat.birthtime.toISOString() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
