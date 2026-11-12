import Link from 'next/link'
import type { AllocationResult } from '@/lib/allocation-advice'
import type { LineAction } from '@/lib/position-sizing'
import { SIZING } from '@/lib/position-sizing'
import { pct, px, signedPct, twd } from './format'

const ACTION_LABEL: Record<LineAction, string> = { buy: '建議買進', trim: '建議減碼', hold: '不動作' }
const ACTION_COLOR: Record<LineAction, string> = { buy: 'text-emerald-400', trim: 'text-amber-400', hold: 'text-zinc-500' }
const SIGNAL_LABEL = {
  'strong-buy': '強力買進', buy: '建議買進', hold: '觀望', avoid: '避開', 'strong-avoid': '強烈避開',
} as const

export function AllocationPanel({ result }: { result: AllocationResult | null }) {
  if (!result) {
    return (
      <div className="bg-zinc-900 rounded p-3 space-y-1">
        <p className="font-mono text-xs text-zinc-400">還沒有庫存或預算，無法建議投入比例</p>
        <Link href="/portfolio" className="font-mono text-xs text-zinc-300 underline underline-offset-2">到持倉頁輸入庫存與預算 →</Link>
      </div>
    )
  }

  const { advice, signal, signalDate } = result
  const stepPct = Math.round(SIZING.stepFraction * advice.pace * 100)
  const trimTotal = advice.lines.reduce((s, l) => s + (l.action === 'trim' ? l.amount : 0), 0)

  return (
    <div className="bg-zinc-900 rounded p-3 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="可用預算" value={twd(advice.cash)} />
        <Stat label="總資產" value={twd(advice.totalValue)} />
        <Stat label="目前股票比例" value={pct(advice.currentExposure, 0)} />
        <Stat label="風險目標比例" value={pct(advice.targetExposure, 0)} />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-800 pt-3">
        <p className="font-mono text-xs text-zinc-400">
          今日建議投入 <span className="text-sm text-emerald-400">{twd(advice.budgetToDeploy)}</span>
          <span className="text-zinc-500">
            {' '}（單次最多動用總資產 {stepPct}%；訊號：{SIGNAL_LABEL[signal]}{signalDate ? ` ${signalDate}` : '，尚無報告'}）
          </span>
        </p>
        {trimTotal > 0 && (
          <p className="font-mono text-xs text-zinc-400">
            另外建議減碼 <span className="text-sm text-amber-400">{twd(trimTotal)}</span>
            <span className="text-zinc-500">（曝險超過目標，與買進訊號無關）</span>
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {advice.lines.map(l => (
          <li key={l.ticker} className="grid grid-cols-1 gap-1 sm:grid-cols-[6rem_6.5rem_1fr_7rem] sm:items-baseline sm:gap-3">
            <span className="font-mono text-xs text-zinc-300">{l.ticker}</span>
            <span className={`font-mono text-xs ${ACTION_COLOR[l.action]}`}>{ACTION_LABEL[l.action]}</span>
            <span className="font-mono text-xs text-zinc-300">
              {l.action === 'hold'
                ? (l.price != null ? `現價 ${px(l.price)}` : '沒有報價')
                : `${l.shares.toLocaleString('en-US')} 股 × ${px(l.price ?? 0)} = ${twd(l.amount)}`}
            </span>
            <span className="font-mono text-xs text-zinc-500 sm:text-right">
              占 {pct(l.currentWeight, 0)} / 目標 {pct(l.targetWeight, 0)}
              {l.pnlPct != null && <> · 損益 {signedPct(l.pnlPct)}</>}
            </span>
          </li>
        ))}
      </ul>

      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer font-mono text-zinc-400">為什麼是這個比例？</summary>
        <ul className="mt-2 space-y-1 font-mono">
          {advice.factors.map(f => (
            <li key={f.label}>{f.label} {f.delta >= 0 ? '+' : ''}{(f.delta * 100).toFixed(0)}%：{f.detail}</li>
          ))}
          <li className="text-zinc-300">＝ 風險目標股票比例 {pct(advice.targetExposure, 0)}</li>
        </ul>
        <p className="mt-2 leading-relaxed">
          方向（漲或跌）在 10 年回測與盲測中沒有可靠預測力，所以目標比例只看風險（趨勢與波動），不受新聞訊號影響。
          每日訊號只調整「靠近目標的速度」：買進＝全速、觀望＝一半、避開＝暫停新增買進。
          不含手續費與稅，僅供資金規劃參考，不是投資建議。
        </p>
      </details>

      {advice.notes.length > 0 && (
        <ul className="space-y-1 border-t border-zinc-800 pt-3">
          {advice.notes.map(n => <li key={n} className="text-xs leading-relaxed text-amber-400/90">· {n}</li>)}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-zinc-500">{label}</p>
      <p className="font-mono text-sm text-zinc-200">{value}</p>
    </div>
  )
}
