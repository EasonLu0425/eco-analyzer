import { backfillPrices, HISTORY_YEARS } from './prices/index'

async function main() {
  const arg = process.argv.slice(2).find(a => a.startsWith('--years='))
  const years = arg ? Number(arg.slice('--years='.length)) : HISTORY_YEARS
  if (!Number.isInteger(years) || years < 1 || years > 30) {
    throw new Error(`--years must be an integer between 1 and 30, got "${arg}"`)
  }

  console.log(`[backfill-prices] 回補 ${years} 年歷史價格...`)
  const result = await backfillPrices(years)
  console.log('[backfill-prices] 完成', JSON.stringify(result))
}

main().catch(err => {
  console.error('[backfill-prices] 失敗:', err)
  process.exit(1)
})
