import { REPORT_SESSIONS, type ReportSession } from '@/types'

/** Parses `morning|midday|close` or `--session=<name>`; empty/undefined means the legacy morning run. */
export function parseSession(value: string | undefined): ReportSession {
  const raw = (value ?? '').trim().toLowerCase().replace(/^--session=/, '')
  if (raw === '') return 'morning'

  const found = REPORT_SESSIONS.find(s => s === raw)
  if (!found) {
    throw new Error(`Unknown session "${value}". Expected one of: ${REPORT_SESSIONS.join(', ')}`)
  }
  return found
}
