import { updatePrices } from './prices/index'

async function main() {
  console.log('[fetch-prices] Starting price update...')
  await updatePrices()
  console.log('[fetch-prices] Done.')
}

main().catch(err => {
  console.error('[fetch-prices] Fatal error:', err)
  process.exit(1)
})
