import pty from 'node-pty'
import path from 'path'

const WORKSPACE_PATH = path.resolve(process.env.WORKSPACE_PATH || process.cwd())
const SHELL_CMD = process.env.SHELL_CMD || (process.platform === 'win32' ? 'powershell.exe' : 'bash')

export function handleTerminalConnection(ws) {
  const shell = pty.spawn(SHELL_CMD, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: WORKSPACE_PATH,
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
