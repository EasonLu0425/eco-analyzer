export const dynamic = 'force-dynamic'

import { getAllocationAdvice } from '@/lib/allocation-advice'
import { positionPnl } from '@/lib/portfolio'
import { getPortfolio, getTrades } from '@/lib/portfolio-store'
import { getPriceHistory } from '@/lib/price-store'
import { AllocationPanel } from '@/components/portfolio/AllocationPanel'
import { PortfolioManager, type HoldingRow } from '@/components/portfolio/PortfolioManager'

const DEFAULT_TICKERS = ['0050.TW', '00692.TW', '00878.TW'] as const
const RECENT_TRADES = 30

export default function PortfolioPage() {
  const { cash, holdings } = getPortfolio()
  const rows: HoldingRow[] = holdings.map(h => {
    const price = getPriceHistory(h.ticker, 1)[0]?.close ?? null
    const { marketValue, pnl, pnlPct } = positionPnl(h, price)
    return { ...h, price, marketValue, pnl, pnlPct }
  })

  return (
    <div>
      <h1 className="pb-5 font-mono text-xs text-ghost">持倉與資金配置</h1>
      <hr />
      <div className="py-6">
        <p className="mb-5 font-mono text-xs text-ghost">今日建議</p>
        <AllocationPanel result={getAllocationAdvice()} />
      </div>
      <hr />
      <div className="py-6">
        <PortfolioManager cash={cash} holdings={rows} trades={getTrades(RECENT_TRADES)} tickers={DEFAULT_TICKERS} />
      </div>
    </div>
  )
}
