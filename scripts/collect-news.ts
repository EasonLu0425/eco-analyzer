import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { collectNews } from './collectors/index.js'

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`[collect-news] 開始蒐集 ${today} 新聞...`)

  const news = await collectNews()
  console.log(`[collect-news] 蒐集完成：${news.length} 則相關新聞`)

  const dir = join(process.cwd(), 'data', 'news')
  mkdirSync(dir, { recursive: true })

  const outPath = join(dir, `${today}.json`)
  writeFileSync(outPath, JSON.stringify(news, null, 2), 'utf-8')
  console.log(`[collect-news] 已存到 ${outPath}`)
}

main().catch(err => {
  console.error('[collect-news] 失敗:', err)
  process.exit(1)
})
