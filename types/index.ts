export type ETFSignal = 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid'

export interface NewsItem {
  title: string
  description: string
  url: string
  publishedAt: string
  source: string
}

export interface HeadlineDetail {
  title: string
  summary: string
  marketImpact: string
}

export interface AnalysisReport {
  id: string
  date: string           // YYYY-MM-DD
  sentimentScore: number // 0–10, 10 = most positive
  signal: ETFSignal
  summary: string
  risks: string[]
  topHeadlines: HeadlineDetail[] | string[]
  newsCount: number
  createdAt: string      // ISO-8601
  priceTrends?: PriceTrend[]
}

export interface PriceRecord {
  date: string       // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PriceTrend {
  ticker: string
  currentClose: number
  change30d: number  // % vs 30 trading days ago
  change90d: number  // % vs 90 trading days ago
  high52w: number
  low52w: number
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

export interface PeriodPricePerformance {
  ticker: string
  startClose: number
  endClose: number
  changePct: number  // %
  high: number
  low: number
}

export interface WeeklyReport {
  id: string
  weekStart: string   // YYYY-MM-DD (Monday)
  weekEnd: string     // YYYY-MM-DD (Sunday)
  avgSentimentScore: number
  dominantSignal: ETFSignal
  tradingDays: number
  pricePerformance: PeriodPricePerformance[]
  keyThemes: string[]
  topRisks: string[]
  weeklyInsight: string
  vsLastWeek: string
  createdAt: string
}

export interface MonthlyReport {
  id: string
  month: string       // YYYY-MM
  tradingDays: number
  avgSentimentScore: number
  dominantSignal: ETFSignal
  sentimentTrend: 'improving' | 'declining' | 'stable'
  pricePerformance: PeriodPricePerformance[]
  keyEvents: string[]
  sectorRotation: string[]
  topRisks: string[]
  monthlyInsight: string
  investmentOutlook: string
  createdAt: string
}
