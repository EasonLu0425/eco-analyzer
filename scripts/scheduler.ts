import 'dotenv/config'
import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { collectNews } from './collectors/index.js'
import { analyzeNews } from './analyzers/index.js'
import { getDb } from '../lib/db.js'

async function runDailyPipeline() {
  const start = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  console.log(`[${new Date().toISOString()}] 開始每日分析 pipeline — ${today}`)

  const db = getDb()
  const existing = db.prepare('SELECT id FROM reports WHERE date = ?').get(today)
  if (existing) {
    console.log(`[pipeline] ${today} 已有報告，略過`)
    return
  }

  // Step 1: 蒐集新聞
  console.log('[1/3] 蒐集中文財經新聞...')
  const news = await collectNews()
  console.log(`[1/3] 蒐集完成：${news.length} 則相關新聞`)

  if (news.length === 0) {
    console.warn('[pipeline] 無新聞資料，略過分析')
    return
  }

  // Step 2: AI 分析
  console.log('[2/3] 呼叫 Claude AI 分析趨勢...')
  const result = await analyzeNews(news)
  console.log(`[2/3] 分析完成：訊號=${result.signal}，分數=${result.sentimentScore}`)

  // Step 3: 寫入 SQLite
  console.log('[3/3] 寫入資料庫...')
  const report = {
    id: randomUUID(),
    date: today,
    sentiment_score: result.sentimentScore,
    signal: result.signal,
    summary: result.summary,
    risks: JSON.stringify(result.risks),
    top_headlines: JSON.stringify(result.topHeadlines),
    news_count: result.newsCount,
    created_at: new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO reports (id, date, sentiment_score, signal, summary, risks, top_headlines, news_count, created_at)
    VALUES (@id, @date, @sentiment_score, @signal, @summary, @risks, @top_headlines, @news_count, @created_at)
  `).run(report)

  console.log(`[3/3] 寫入完成 (id=${report.id})`)
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
