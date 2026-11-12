import type { RevenueSignal, StoredWatchSignal } from '@/lib/watch-signals'
import { WATCH_KEYS, daysSince, isStale, type WatchKey, type WatchStatus } from '@/lib/watch-keys'

const KEY_LABEL: Record<WatchKey, string> = {
  'hyperscaler-capex': '雲端大廠資本支出',
  'cowos-capacity': 'CoWoS 先進封裝產能',
  'power-supply': '電力供給與電價',
}

const STATUS_LABEL: Record<WatchStatus, string> = { improving: '轉強', steady: '持平', weakening: '轉弱' }
const STATUS_COLOR: Record<WatchStatus, string> = {
  improving: 'text-emerald-400', steady: 'text-zinc-400', weakening: 'text-rose-400',
}

/** Signed fixed-point string; a value that rounds to zero is shown without a sign ("0.0", never "-0.0"). */
export function signed(v: number, digits = 1): string {
  const text = v.toFixed(digits)
  if (Number(text) === 0) return (0).toFixed(digits)
  return `${v > 0 ? '+' : ''}${text}`
}

interface RowProps {
  label: string
  status: WatchStatus | null
  detail: string
  source?: string
  date: string | null
  today: string
}

function Row({ label, status, detail, source, date, today }: RowProps) {
  const stale = date !== null && isStale(date, today)
  return (
    <li className={`grid grid-cols-1 gap-1 sm:grid-cols-[9.5rem_4rem_1fr] sm:items-baseline sm:gap-3 ${stale ? 'opacity-60' : ''}`}>
      <span className="font-mono text-xs text-zinc-400">{label}</span>
      <span className={`font-mono text-xs ${status ? STATUS_COLOR[status] : 'text-zinc-500'}`}>
        {status ? STATUS_LABEL[status] : '尚無紀錄'}
      </span>
      <span className="text-xs leading-relaxed text-zinc-400">
        {detail}
        {source && <span className="block text-zinc-500">來源：{source}</span>}
        {date && (
          <span className="mt-0.5 block font-mono text-zinc-500">
            {date}{stale ? `（${daysSince(date, today)} 天前，可能已過時）` : ''}
          </span>
        )}
      </span>
    </li>
  )
}

interface PanelProps {
  revenue: RevenueSignal | null
  signals: readonly StoredWatchSignal[]
  /** Today's date (YYYY-MM-DD), used to flag stale signals. */
  today: string
}

export function WatchSignalsPanel({ revenue, signals, today }: PanelProps) {
  return (
    <div className="bg-zinc-900 rounded p-3 space-y-3">
      <ul className="space-y-3">
        <Row
          label="台積電月營收年增率"
          status={revenue?.status ?? null}
          detail={revenue ? `${signed(revenue.latest)}%，較上次公布 ${signed(revenue.change)} 個百分點` : '資料不足'}
          date={revenue?.asOf ?? null}
          today={today}
        />
        {WATCH_KEYS.map(key => {
          const s = signals.find(x => x.key === key)
          return (
            <Row
              key={key}
              label={KEY_LABEL[key]}
              status={s?.status ?? null}
              detail={s?.note ?? '新聞中尚未出現相關消息'}
              source={s?.source || undefined}
              date={s?.date ?? null}
              today={today}
            />
          )
        })}
      </ul>
      <p className="text-xs leading-relaxed text-zinc-400">
        這些是 AI 資本支出論述的先行訊號，用來判斷長期趨勢有沒有轉折，不是買賣時點。
        質性訊號由每日新聞判讀；新聞沒提到就不記錄，顯示的是最後一次有消息的狀態與日期，超過 30 天會變淡。
      </p>
    </div>
  )
}
