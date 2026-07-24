import { Router } from 'express'
import { readUsageRecords } from './usage.js'
import { getPricingTable, computeCost } from './pricing.js'

export const usageRouter = Router()

const DAYS = 7

function utcDateString(date) {
  return date.toISOString().slice(0, 10)
}

function last7DayStrings() {
  const days = []
  const now = new Date()
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    days.push(utcDateString(d))
  }
  return days
}

function emptyBucket() {
  return { tokensUsed: 0, costSum: 0, allPriced: true, hasTokens: false }
}

function addToBucket(bucket, tokens, cost) {
  bucket.tokensUsed += tokens
  bucket.hasTokens = bucket.hasTokens || tokens > 0
  if (cost === null) {
    bucket.allPriced = false
  } else {
    bucket.costSum += cost
  }
}

function finalizeBucket(bucket) {
  const cost = !bucket.hasTokens ? 0 : bucket.allPriced ? Number(bucket.costSum.toFixed(6)) : null
  return { tokensUsed: bucket.tokensUsed, cost }
}

// GET /api/usage -> uso do Claude Code lido dos logs locais de sessão
// (~/.claude/projects, ou CLAUDE_CONFIG_DIR se configurado). Não inclui
// informação de limite/janela de reset da assinatura porque essa
// informação não existe nesses logs — só é exposta pela própria CLI/app,
// não fica gravada em disco.
usageRouter.get('/', async (req, res) => {
  try {
    const days = last7DayStrings()
    const sinceISO = `${days[0]}T00:00:00.000Z`

    const [records, pricingTable] = await Promise.all([
      readUsageRecords({ since: sinceISO }),
      getPricingTable(),
    ])

    const dayBuckets = new Map(days.map((d) => [d, emptyBucket()]))
    const modelBuckets = new Map()

    for (const record of records) {
      const tokens = record.input + record.output + record.cacheCreate5m + record.cacheCreate1h + record.cacheRead
      const cost = computeCost(record, pricingTable)

      const dayBucket = dayBuckets.get(record.date)
      if (dayBucket) addToBucket(dayBucket, tokens, cost)

      if (!modelBuckets.has(record.model)) modelBuckets.set(record.model, emptyBucket())
      addToBucket(modelBuckets.get(record.model), tokens, cost)
    }

    const today = days[days.length - 1]
    const last7days = days.map((date) => ({ date, ...finalizeBucket(dayBuckets.get(date)) }))
    const byModel = [...modelBuckets.entries()]
      .map(([model, bucket]) => ({ model, ...finalizeBucket(bucket) }))
      .sort((a, b) => b.tokensUsed - a.tokensUsed)

    const pricingIncomplete = !pricingTable || byModel.some((m) => m.cost === null && m.tokensUsed > 0)

    res.json({
      today: { date: today, ...finalizeBucket(dayBuckets.get(today)) },
      last7days,
      byModel,
      pricingIncomplete,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
