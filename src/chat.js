import { query } from '@anthropic-ai/claude-agent-sdk'
import path from 'path'
import { supabaseAdmin } from './supabaseAdmin.js'

const WORKSPACE_PATH = path.resolve(process.env.WORKSPACE_PATH || process.cwd())

async function saveMessage(sessionId, remetente, conteudo) {
  await supabaseAdmin.from('painel_dev_mensagens').insert({ sessao: sessionId, remetente, conteudo })
}

// Fila simples que alimenta o generator consumido pelo SDK: cada prompt que
// chega pelo WebSocket vira um item da fila, sem nunca reiniciar a chamada a
// `query()` — é isso que mantém uma única sessão do Claude Code viva (com
// contexto) durante toda a conexão, em vez de um processo novo por mensagem.
function createPromptQueue() {
  const pending = []
  let resolveNext = null

  function push(text) {
    if (resolveNext) {
      const resolve = resolveNext
      resolveNext = null
      resolve(text)
    } else {
      pending.push(text)
    }
  }

  async function* generator() {
    while (true) {
      const text = pending.length > 0 ? pending.shift() : await new Promise((resolve) => (resolveNext = resolve))
      if (text === null) return
      // NOTA: formato exato da mensagem de entrada em streaming ainda não
      // verificado contra a versão instalada do @anthropic-ai/claude-agent-sdk
      // — conferir contra https://code.claude.com/docs/en/agent-sdk se o SDK
      // rejeitar esse shape.
      yield { type: 'user', message: { role: 'user', content: text } }
    }
  }

  return { push, generator, stop: () => push(null) }
}

export function handleChatConnection(ws, { sessionId }) {
  const queue = createPromptQueue()
  let started = false

  async function start() {
    started = true
    const stream = query({
      prompt: queue.generator(),
      options: {
        cwd: WORKSPACE_PATH,
        permissionMode: 'acceptEdits',
      },
    })

    for await (const message of stream) {
      if (message.type === 'assistant') {
        const text = (message.message?.content ?? [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
        if (text) {
          ws.send(JSON.stringify({ type: 'assistant_message', text }))
          await saveMessage(sessionId, 'assistant', text)
        }
      } else if (message.type === 'result') {
        ws.send(JSON.stringify({ type: 'turn_done' }))
      }
    }
  }

  ws.on('message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type !== 'prompt' || !msg.text) return

    await saveMessage(sessionId, 'user', msg.text)
    queue.push(msg.text)

    if (!started) {
      start().catch((err) => {
        ws.send(JSON.stringify({ type: 'error', message: err.message }))
      })
    }
  })

  ws.on('close', () => queue.stop())
}
