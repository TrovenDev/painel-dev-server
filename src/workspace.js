import path from 'path'

// WORKSPACE_PATH agora é a pasta RAIZ que contém um subdiretório por projeto
// (ex: /workspace/sistema-estoque, /workspace/painel-financeiro). Nada em
// files.js/terminal.js/chat.js deve mais operar direto na raiz — sempre
// dentro de um projeto específico.
export const WORKSPACE_PATH = path.resolve(process.env.WORKSPACE_PATH || process.cwd())

// Sem pontos: bloqueia ".." (path traversal) e nomes ocultos/relativos de
// quebra, sem precisar de uma blocklist de sequências perigosas.
const PROJECT_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/

export function isValidProjectName(name) {
  return typeof name === 'string' && PROJECT_NAME_RE.test(name)
}

// Resolve e valida o path de um projeto dentro do workspace. Lança erro se
// o nome for inválido — nunca deixa passar algo que escape da raiz.
export function resolveProjectRoot(projectName) {
  if (!isValidProjectName(projectName)) {
    throw new Error('Nome de projeto inválido.')
  }
  return path.join(WORKSPACE_PATH, projectName)
}

// Garante que o caminho pedido nunca escape do diretório base (ex:
// "../../etc/passwd" ou um caminho absoluto tentando substituir a base).
export function resolveSafe(baseDir, relativePath) {
  const target = path.resolve(baseDir, relativePath || '.')
  const withSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep
  if (target !== baseDir && !target.startsWith(withSep)) {
    throw new Error('Caminho fora do projeto.')
  }
  return target
}
