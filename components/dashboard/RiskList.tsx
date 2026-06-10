export function RiskList({ risks }: { risks: string[] }) {
  return (
    <ul className="space-y-0">
      {risks.map((risk, i) => {
        const notLast = i < risks.length - 1
        return (
          <li key={i} className={`flex items-start gap-3 py-3 text-sm ${notLast ? 'border-b border-edge' : ''}`}>
            <span className="text-avoid mt-0.5 shrink-0 text-xs leading-none">—</span>
            <span className="text-dim leading-relaxed">{risk}</span>
          </li>
        )
      })}
    </ul>
  )
}
