import pty from 'node-pty'
import fs from 'fs/promises'
import { resolveProjectRoot } from './workspace.js'

const SHELL_CMD = process.env.SHELL_CMD || (process.platform === 'win32' ? 'powershell.exe' : 'bash')

export async function handleTerminalConnection(ws, { projectName }) {
  let projectPath
  try {
    projectPath = resolveProjectRoot(projectName)
    const stat = await fs.stat(projectPath)
    if (!stat.isDirectory()) throw new Error('Projeto inválido.')
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Projeto inválido ou inexistente.' }))
    ws.close()
    return
  }

  const shell = pty.spawn(SHELL_CMD, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: projectPath,
    env: process.env,
  })

  shell.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'data', data }))
  })

  shell.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'exit', exitCode }))
    ws.close()
  })

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'input') shell.write(msg.data)
    else if (msg.type === 'resize') shell.resize(msg.cols, msg.rows)
  })

  ws.on('close', () => shell.kill())
}
