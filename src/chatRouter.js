import { Router } from 'express'
import { supabaseAdmin } from './supabaseAdmin.js'
import { isValidProjectName } from './workspace.js'

export const chatRouter = Router()

// GET /api/chat/history?project=sistema-estoque&session=default&limit=200
// -> histórico de mensagens daquele projeto (e, se informado, daquela
// sessão), em ordem cronológica.
chatRouter.get('/history', async (req, res) => {
  try {
    const project = req.query.project
    if (!isValidProjectName(project)) {
      return res.status(400).json({ error: 'Parâmetro "project" é obrigatório e deve ser válido.' })
    }

    const limit = Math.min(Number(req.query.limit) || 200, 1000)

    let queryBuilder = supabaseAdmin
      .from('painel_dev_mensagens')
      .select('*')
      .eq('project_name', project)
      .order('id', { ascending: true })
      .limit(limit)

    if (req.query.session) {
      queryBuilder = queryBuilder.eq('sessao', req.query.session)
    }

    const { data, error } = await queryBuilder
    if (error) throw error

    res.json({ items: data })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
