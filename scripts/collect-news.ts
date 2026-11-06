import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { NewsItem } from '../types'
import { mergeNewsItems, saveNewsItems } from '../lib/news-store'
import { taipeiToday } from '../lib/report-store'
import { parseSession } from '../lib/session'
import { collectNews } from './collectors/index.js'

function readExisting(path: string): NewsItem[] {
  if (!existsSync(path)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as NewsItem[]) : []
  } catch (err) {
    console.error(`[collect-news] 既有檔案無法解析，將以本次結果重建: ${(err as Error).message}`)
    return []
  }
}

async function main() {
  const session = parseSession(process.argv.slice(2).find(a => a.startsWith('--session=')))
  const today = taipeiToday()
  console.log(`[collect-news] 開始蒐集 ${today}（${session}）新聞...`)

  const news = await collectNews()
  console.log(`[collect-news] 蒐集完成：${news.length} 則相關新聞`)

  const dir = join(process.cwd(), 'data', 'news')
  mkdirSync(dir, { recursive: true })
  const outPath = join(dir, `${today}.json`)

  // Merge instead of overwrite: later sessions add to what earlier sessions already collected.
  const merged = mergeNewsItems(readExisting(outPath), news)
  writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8')

  const added = saveNewsItems(news, today, session)
  console.log(`[collect-news] 本時段新增 ${added} 則（當日累計 ${merged.length} 則）→ ${outPath}`)
}

main().catch(err => {
  console.error('[collect-news] 失敗:', err)
  process.exit(1)
})
