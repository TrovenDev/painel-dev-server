import { createClient } from '@supabase/supabase-js'

// Reaproveita o mesmo login do Sistema Troven (Supabase Auth) — o painel-dev
// não tem autenticação própria. O frontend manda o access_token da sessão
// já logada, e aqui a gente só valida esse token contra o Supabase.
const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export async function verifyToken(token) {
  if (!token) return null
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
