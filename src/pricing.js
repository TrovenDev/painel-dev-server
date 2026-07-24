// Preço por token dos modelos Claude. Mesma fonte que a ferramenta
// "ccusage" usa (https://ccusage.com) pra calcular custo a partir dos logs
// locais do Claude Code: a tabela pública da LiteLLM, que tem entradas para
// cada model id exatamente como aparece nos logs (ex: "claude-sonnet-5").
// Não existe "costUSD" pronto nos logs desta instalação — então o custo
// sempre é calculado a partir dessa tabela, nunca inventado.
const PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h

let cache = null // { data, fetchedAt }

async function fetchPricingTable() {
  const res = await fetch(PRICING_URL)
  if (!res.ok) throw new Error(`Falha ao buscar tabela de preços (HTTP ${res.status}).`)
  return res.json()
}

// Retorna a tabela de preços, com cache em memória. Se o fetch falhar mas
// já existir um cache (mesmo vencido), usa o cache velho em vez de
// quebrar — melhor um preço levemente desatualizado do que nenhum. Se
// nunca conseguiu buscar, retorna null (o chamador trata custo como
// indisponível, não inventa número).
export async function getPricingTable() {
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS
  if (isFresh) return cache.data

  try {
    const data = await fetchPricingTable()
    cache = { data, fetchedAt: Date.now() }
    return data
  } catch {
    return cache ? cache.data : null
  }
}

// Calcula o custo de uma entrada de uso a partir dos tokens reais do log e
// do preço por token do modelo. Retorna null se o modelo não estiver na
// tabela de preços (em vez de chutar um valor).
export function computeCost(entry, pricingTable) {
  const p = pricingTable?.[entry.model]
  if (!p) return null

  const cacheCreate1hRate = p.cache_creation_input_token_cost_above_1hr ?? p.cache_creation_input_token_cost ?? 0

  return (
    (entry.input || 0) * (p.input_cost_per_token || 0) +
    (entry.output || 0) * (p.output_cost_per_token || 0) +
    (entry.cacheRead || 0) * (p.cache_read_input_token_cost || 0) +
    (entry.cacheCreate5m || 0) * (p.cache_creation_input_token_cost || 0) +
    (entry.cacheCreate1h || 0) * cacheCreate1hRate
  )
}
