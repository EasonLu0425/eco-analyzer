// feat/scheduler 在這裡實作完整 pipeline
// 執行方式: pnpm scheduler
import 'dotenv/config'

async function runDailyPipeline() {
  console.log(`[${new Date().toISOString()}] 開始每日分析 pipeline...`)
  // Step 1: collectNews()  — 實作於 feat/news-collector (scripts/collectors/index.ts)
  const { collectNews } = await import('./collectors/index.js')
  const news = await collectNews()
  console.log(`[collect] 蒐集到 ${news.length} 則相關新聞`)
  // Step 2: analyzeNews()  — 實作於 feat/llm-analyzer  (scripts/analyzers/index.ts)
  // Step 3: 寫入 SQLite    — lib/db.ts getDb()
  console.log('Pipeline stubs — 請先完成 feat/news-collector 和 feat/llm-analyzer')
}

runDailyPipeline()
