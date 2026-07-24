import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import readline from 'readline'
import { createReadStream } from 'fs'

// Mesmo lugar que ferramentas como "ccusage" leem: o Claude Code grava um
// arquivo .jsonl por sessão (e por subagente) dentro de
// ~/.claude/projects/<pasta-do-projeto>/**.jsonl. CLAUDE_CONFIG_DIR é a
// forma oficial de apontar pra outro lugar (ex: dentro do container).
function resolveClaudeConfigDir() {
  const override = process.env.CLAUDE_CONFIG_DIR
  return override ? path.resolve(override) : path.join(os.homedir(), '.claude')
}

async function listJsonlFiles() {
  const projectsDir = path.join(resolveClaudeConfigDir(), 'projects')
  let entries
  try {
    entries = await fs.readdir(projectsDir, { withFileTypes: true, recursive: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => path.join(e.parentPath ?? projectsDir, e.name))
}

async function* readJsonLines(filePath) {
  const rl = readline.createInterface({ input: createReadStream(filePath, 'utf-8'), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      yield JSON.parse(line)
    } catch {
      // linha corrompida/truncada (ex: processo morto no meio da escrita) — ignora
    }
  }
}

// Normaliza uma linha de log em um registro de uso, ou null se a linha não
// representa uso de tokens de verdade (ex: mensagens "<synthetic>" que o
// Claude Code injeta localmente, como o aviso de limite de gasto atingido —
// sempre vêm com todos os contadores zerados).
function toUsageRecord(line) {
  if (line?.type !== 'assistant') return null
  const msg = line.message
  const usage = msg?.usage
  if (!usage) return null

  const input = usage.input_tokens || 0
  const output = usage.output_tokens || 0
  const cacheCreate5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? usage.cache_creation_input_tokens ?? 0
  const cacheCreate1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens || 0

  if (input + output + cacheCreate5m + cacheCreate1h + cacheRead === 0) return null

  const timestamp = line.timestamp
  if (!timestamp) return null

  return {
    dedupeKey: `${msg.id ?? ''}:${line.requestId ?? line.uuid}`,
    timestamp,
    date: timestamp.slice(0, 10), // YYYY-MM-DD (UTC, como gravado no log)
    model: msg.model,
    input,
    output,
    cacheCreate5m,
    cacheCreate1h,
    cacheRead,
  }
}

// Lê todos os logs de sessão do Claude Code e devolve os registros de uso
// já deduplicados. Streaming grava snapshots parciais do mesmo request
// conforme a resposta chega — o dedupe por "messageId:requestId" mantém só
// a última ocorrência de cada request (que tem os totais finais).
export async function readUsageRecords({ since } = {}) {
  const files = await listJsonlFiles()
  const byKey = new Map()

  for (const file of files) {
    for await (const line of readJsonLines(file)) {
      const record = toUsageRecord(line)
      if (!record) continue
      if (since && record.timestamp < since) continue
      byKey.set(record.dedupeKey, record)
    }
  }

  return [...byKey.values()]
}
