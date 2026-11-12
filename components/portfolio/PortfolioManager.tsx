'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { px, signedPct, twd } from './format'

export interface HoldingRow {
  ticker: string
  shares: number
  avgCost: number
  price: number | null
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
}

export interface TradeRow {
  id: number
  date: string
  ticker: string
  side: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
}

interface Props {
  cash: number
  holdings: HoldingRow[]
  trades: TradeRow[]
  tickers: readonly string[]
}

const FIELD = 'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none'
const BTN = 'rounded border border-zinc-600 px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40'
const LABEL = 'mb-1 block font-mono text-[10px] text-zinc-500'

/** Fixed to Taipei time so server render and browser agree on the date (no hydration mismatch). */
const localToday = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

async function send(method: string, url: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.success) return null
    return json?.error ?? `請求失敗（${res.status}）`
  } catch {
    return '網路錯誤，請稍後再試'
  }
}

export function PortfolioManager({ cash, holdings, trades, tickers }: Props) {
  const router = useRouter()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [amount, setAmount] = useState('')
  const [hTicker, setHTicker] = useState(tickers[0] ?? '')
  const [hShares, setHShares] = useState('')
  const [hCost, setHCost] = useState('')
  const [tTicker, setTTicker] = useState(tickers[0] ?? '')
  const [tSide, setTSide] = useState<'buy' | 'sell'>('buy')
  const [tShares, setTShares] = useState('')
  const [tPrice, setTPrice] = useState('')
  const [tFee, setTFee] = useState('')
  const [tDate, setTDate] = useState(localToday)

  async function run(action: () => Promise<string | null>, success: string, after?: () => void) {
    setBusy(true)
    setMessage(null)
    const error = await action()
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: error })
      return
    }
    setMessage({ kind: 'ok', text: success })
    after?.()
    router.refresh()
  }

  const num = (v: string): number => (v.trim() === '' ? Number.NaN : Number(v))

  const budget = (mode: 'set' | 'add' | 'sub') => {
    const value = num(amount)
    const request = mode === 'set'
      ? () => send('PUT', '/api/portfolio/budget', { amount: value })
      : () => send('POST', '/api/portfolio/budget', { delta: mode === 'add' ? value : -value })
    return run(request, '預算已更新', () => setAmount(''))
  }

  const saveHolding = (e: FormEvent) => {
    e.preventDefault()
    return run(
      () => send('PUT', '/api/portfolio/holdings', { ticker: hTicker.trim().toUpperCase(), shares: num(hShares), avgCost: hShares === '0' ? 0 : num(hCost) }),
      '庫存已儲存（不影響預算）',
      () => { setHShares(''); setHCost('') },
    )
  }

  const saveTrade = (e: FormEvent) => {
    e.preventDefault()
    return run(
      () => send('POST', '/api/portfolio/trades', {
        ticker: tTicker.trim().toUpperCase(), side: tSide, shares: num(tShares), price: num(tPrice), fee: tFee.trim() === '' ? 0 : num(tFee), date: tDate,
      }),
      '交易已記錄，庫存與預算已同步更新',
      () => { setTShares(''); setTPrice(''); setTFee('') },
    )
  }

  const removeRow = (ticker: string) => {
    if (!window.confirm(`移除 ${ticker}？股數與成本會被刪除，預算不會變動。`)) return
    return run(() => send('DELETE', `/api/portfolio/holdings?ticker=${encodeURIComponent(ticker)}`), `已移除 ${ticker}`)
  }

  const editRow = (h: HoldingRow) => {
    setHTicker(h.ticker)
    setHShares(String(h.shares))
    setHCost(h.shares > 0 ? String(h.avgCost) : '')
  }

  return (
    <div className="space-y-10">
      <datalist id="tickers">{tickers.map(t => <option key={t} value={t} />)}</datalist>

      <div role="status" aria-live="polite" className="min-h-5">
        {message && (
          <p className={`font-mono text-xs ${message.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
        )}
      </div>

      <section aria-labelledby="budget-h" className="space-y-3">
        <h2 id="budget-h" className="font-mono text-xs text-ghost">預算（可動用的現金）</h2>
        <p className="font-mono text-2xl text-ink">{twd(cash)}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <label htmlFor="amount" className={LABEL}>金額（NT$）</label>
            <input id="amount" inputMode="decimal" className={FIELD} value={amount} onChange={e => setAmount(e.target.value)} placeholder="100000" />
          </div>
          <button type="button" className={BTN} disabled={busy} onClick={() => budget('add')}>增加</button>
          <button type="button" className={BTN} disabled={busy} onClick={() => budget('sub')}>減少</button>
          <button type="button" className={BTN} disabled={busy} onClick={() => budget('set')}>設定為這個金額</button>
        </div>
      </section>

      <section aria-labelledby="holdings-h" className="space-y-3">
        <h2 id="holdings-h" className="font-mono text-xs text-ghost">庫存與成本</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-dim">還沒有庫存。輸入你目前持有的股數與平均成本；股數填 0 代表只關注、尚未持有。</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded bg-zinc-900">
            {holdings.map(h => (
              <li key={h.ticker} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
                <span className="font-mono text-sm text-zinc-200">{h.ticker}</span>
                <span className="font-mono text-xs leading-relaxed text-zinc-400">
                  {h.shares.toLocaleString('en-US')} 股 · 成本 {h.avgCost || '—'}
                  {h.price != null && <> · 現價 {px(h.price)}</>}
                  {h.marketValue != null && <> · 市值 {twd(h.marketValue)}</>}
                  {h.pnl != null && h.pnlPct != null && (
                    <span className={h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}> · 損益 {twd(h.pnl)}（{signedPct(h.pnlPct)}）</span>
                  )}
                </span>
                <span className="flex gap-2">
                  <button type="button" className={BTN} aria-label={`編輯 ${h.ticker}`} onClick={() => editRow(h)}>編輯</button>
                  <button type="button" className={BTN} aria-label={`移除 ${h.ticker}`} disabled={busy} onClick={() => removeRow(h.ticker)}>移除</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={saveHolding} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="h-ticker" className={LABEL}>代號</label>
            <input id="h-ticker" list="tickers" required className={FIELD} value={hTicker} onChange={e => setHTicker(e.target.value)} />
          </div>
          <div>
            <label htmlFor="h-shares" className={LABEL}>持有股數</label>
            <input id="h-shares" inputMode="numeric" required className={FIELD} value={hShares} onChange={e => setHShares(e.target.value)} placeholder="1000" />
          </div>
          <div>
            <label htmlFor="h-cost" className={LABEL}>平均成本（每股）</label>
            <input id="h-cost" inputMode="decimal" className={FIELD} value={hCost} onChange={e => setHCost(e.target.value)} placeholder="58.5" />
          </div>
          <button type="submit" className={BTN} disabled={busy}>儲存庫存</button>
        </form>
        <p className="text-xs text-zinc-500">直接輸入庫存只會覆蓋股數與成本，不會動到預算。</p>
      </section>

      <section aria-labelledby="trade-h" className="space-y-3">
        <h2 id="trade-h" className="font-mono text-xs text-ghost">記錄一筆買賣</h2>
        <form onSubmit={saveTrade} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
          <div>
            <label htmlFor="t-ticker" className={LABEL}>代號</label>
            <input id="t-ticker" list="tickers" required className={FIELD} value={tTicker} onChange={e => setTTicker(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t-side" className={LABEL}>方向</label>
            <select id="t-side" className={FIELD} value={tSide} onChange={e => setTSide(e.target.value as 'buy' | 'sell')}>
              <option value="buy">買進</option>
              <option value="sell">賣出</option>
            </select>
          </div>
          <div>
            <label htmlFor="t-shares" className={LABEL}>股數</label>
            <input id="t-shares" inputMode="numeric" required className={FIELD} value={tShares} onChange={e => setTShares(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t-price" className={LABEL}>成交價</label>
            <input id="t-price" inputMode="decimal" required className={FIELD} value={tPrice} onChange={e => setTPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t-fee" className={LABEL}>手續費（選填）</label>
            <input id="t-fee" inputMode="decimal" className={FIELD} value={tFee} onChange={e => setTFee(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label htmlFor="t-date" className={LABEL}>日期</label>
            <input id="t-date" type="date" required className={FIELD} value={tDate} onChange={e => setTDate(e.target.value)} />
          </div>
          <button type="submit" className={`${BTN} col-span-2 sm:col-span-1`} disabled={busy}>記錄交易</button>
        </form>
        <p className="text-xs text-zinc-500">買進會扣預算、賣出會加預算，並自動更新股數與平均成本（含手續費）。</p>

        {trades.length > 0 && (
          <table className="w-full font-mono text-xs text-zinc-400">
            <caption className="sr-only">最近的交易紀錄</caption>
            <thead>
              <tr className="text-left text-zinc-600">
                <th scope="col" className="py-1 font-normal">日期</th>
                <th scope="col" className="font-normal">代號</th>
                <th scope="col" className="font-normal">方向</th>
                <th scope="col" className="text-right font-normal">股數</th>
                <th scope="col" className="text-right font-normal">成交價</th>
                <th scope="col" className="text-right font-normal">手續費</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className="border-t border-zinc-800">
                  <td className="py-1">{t.date}</td>
                  <td>{t.ticker}</td>
                  <td className={t.side === 'buy' ? 'text-emerald-400' : 'text-amber-400'}>{t.side === 'buy' ? '買進' : '賣出'}</td>
                  <td className="text-right">{t.shares.toLocaleString('en-US')}</td>
                  <td className="text-right">{t.price}</td>
                  <td className="text-right">{t.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
