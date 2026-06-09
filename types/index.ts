export type ETFSignal = 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid'

export interface NewsItem {
  title: string
  description: string
  url: string
  publishedAt: string
  source: string
}

export interface AnalysisReport {
  id: string
  date: string           // YYYY-MM-DD
  sentimentScore: number // 0–10, 10 = most positive
  signal: ETFSignal
  summary: string
  risks: string[]
  topHeadlines: string[]
  newsCount: number
  createdAt: string      // ISO-8601
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export interface PaginatedReports {
  reports: AnalysisReport[]
  total: number
  page: number
  limit: number
}
