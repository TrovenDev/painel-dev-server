import { createClient } from '@supabase/supabase-js'

// Service role: contorna a RLS pra gravar o histórico de qualquer sessão,
// sem depender do token do usuário logado no momento do insert.
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
