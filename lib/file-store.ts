import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AnalysisReport } from '@/types'

const REPORTS_DIR = join(process.cwd(), 'data', 'reports')

function readReport(filePath: string): AnalysisReport | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as AnalysisReport
  } catch {
    return null
  }
}

export function getLatestReport(): AnalysisReport | null {
  if (!existsSync(REPORTS_DIR)) return null
  const files = readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
  if (files.length === 0) return null
  return readReport(join(REPORTS_DIR, files[0]))
}

export function getReportByDate(date: string): AnalysisReport | null {
  const filePath = join(REPORTS_DIR, `${date}.json`)
  if (!existsSync(filePath)) return null
  return readReport(filePath)
}

export function getReports(page: number, limit: number): { reports: AnalysisReport[]; total: number } {
  if (!existsSync(REPORTS_DIR)) return { reports: [], total: 0 }
  const files = readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
  const total = files.length
  const slice = files.slice((page - 1) * limit, page * limit)
  const reports = slice.map(f => readReport(join(REPORTS_DIR, f))).filter(Boolean) as AnalysisReport[]
  return { reports, total }
}
