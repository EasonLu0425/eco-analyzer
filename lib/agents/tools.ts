import type Database from 'better-sqlite3'
import { z } from 'zod'
import { tool } from '@langchain/core/tools'
import { getDb, rowToReport } from '@/lib/db'
import { collectNews } from '@/scripts/collectors'
import type { AnalysisReport, ETFSignal, NewsItem } from '@/types'

export function queryReportsByDateRange(
  fromDate: string,
  toDate: string,
  db?: Database.Database,
): AnalysisReport[] {
  const d = db ?? getDb()
  const rows = d
    .prepare('SELECT * FROM reports WHERE date BETWEEN ? AND ? ORDER BY date DESC')
    .all(fromDate, toDate)
  return rows.map(r => rowToReport(r as Record<string, unknown>))
}

export function queryReportsBySignal(
  signal: ETFSignal,
  limit = 10,
  db?: Database.Database,
): AnalysisReport[] {
  const d = db ?? getDb()
  const rows = d
    .prepare('SELECT * FROM reports WHERE signal = ? ORDER BY date DESC LIMIT ?')
    .all(signal, limit)
  return rows.map(r => rowToReport(r as Record<string, unknown>))
}

export async function getLatestNews(limit = 10): Promise<NewsItem[]> {
  const items = await collectNews()
  return items.slice(0, limit)
}

const SIGNALS = ['strong-buy', 'buy', 'hold', 'avoid', 'strong-avoid'] as const

export const queryReportsByDateRangeTool = tool(
  async ({ fromDate, toDate }) => JSON.stringify(queryReportsByDateRange(fromDate, toDate)),
  {
    name: 'query_reports_by_date_range',
    description: '查詢指定日期區間（YYYY-MM-DD，含首尾）內的每日 ETF 分析報告，含情緒分數、訊號、摘要與風險。',
    schema: z.object({
      fromDate: z.string().describe('起始日期，格式 YYYY-MM-DD'),
      toDate: z.string().describe('結束日期，格式 YYYY-MM-DD'),
    }),
  },
)

export const queryReportsBySignalTool = tool(
  async ({ signal, limit }) => JSON.stringify(queryReportsBySignal(signal, limit)),
  {
    name: 'query_reports_by_signal',
    description: '查詢特定訊號（如 buy、avoid）的歷史報告，按日期新到舊排序。',
    schema: z.object({
      signal: z.enum(SIGNALS).describe('要篩選的 ETF 訊號'),
      limit: z.number().int().min(1).max(50).default(10).describe('回傳筆數上限'),
    }),
  },
)

export const getLatestNewsTool = tool(
  async ({ limit }) => JSON.stringify(await getLatestNews(limit)),
  {
    name: 'get_latest_news',
    description: '抓取當下最新的台灣財經新聞標題，用於了解報告資料庫尚未涵蓋的最新市場動態。',
    schema: z.object({
      limit: z.number().int().min(1).max(30).default(10).describe('回傳新聞筆數上限'),
    }),
  },
)

export const agentTools = [queryReportsByDateRangeTool, queryReportsBySignalTool, getLatestNewsTool]
