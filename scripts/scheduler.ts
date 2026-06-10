import 'dotenv/config'
import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { collectNews } from './collectors/index.js'
import { analyzeNews } from './analyzers/index.js'
import { updatePrices } from './prices/index.js'
import { getDb } from '../lib/db.js'
import { saveReport, getReportByDate } from '../lib/report-store.js'

async function runDailyPipeline() {
  const start = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  console.log(`[${new Date().toISOString()}] 開始每日分析 pipeline — ${today}`)

  const db = getDb()
  if (getReportByDate(today, db)) {
    console.log(`[pipeline] ${today} 已有報告，略過`)
    return
  }

  // Step 1: 更新價格資料
  console.log('[1/4] 更新價格資料...')
  await updatePrices(db)
  console.log('[1/4] 價格更新完成')

  // Step 2: 蒐集新聞
  console.log('[2/4] 蒐集中文財經新聞...')
  const news = await collectNews()
  console.log(`[2/4] 蒐集完成：${news.length} 則相關新聞`)

  if (news.length === 0) {
    console.warn('[pipeline] 無新聞資料，略過分析')
    return
  }

  // Step 3: AI 分析
  console.log('[3/4] 呼叫 Claude AI 分析趨勢...')
  const result = await analyzeNews(news)
  console.log(`[3/4] 分析完成：訊號=${result.signal}，分數=${result.sentimentScore}`)

  // Step 4: 寫入 SQLite
  console.log('[4/4] 寫入資料庫...')
  const report = {
    id: randomUUID(),
    date: today,
    sentimentScore: result.sentimentScore,
    signal: result.signal,
    summary: result.summary,
    risks: result.risks,
    topHeadlines: result.topHeadlines,
    newsCount: result.newsCount,
    createdAt: new Date().toISOString(),
    priceTrends: result.priceTrends,
  }
  saveReport(report, db)

  console.log(`[4/4] 寫入完成 (id=${report.id})`)
  console.log(`[pipeline] 完成，耗時 ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

// 每天早上 08:30 台灣時間執行
if (process.env.SCHEDULER_MODE === 'cron') {
  console.log('[scheduler] 啟動排程模式，每日 08:30 Asia/Taipei 執行')
  cron.schedule('30 8 * * *', () => runDailyPipeline(), { timezone: 'Asia/Taipei' })
} else {
  // 直接執行一次（pnpm analyze）
  runDailyPipeline().catch(err => {
    console.error('[pipeline] 執行失敗:', err)
    process.exit(1)
  })
}
