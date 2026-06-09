export function RiskList({ risks }: { risks: string[] }) {
  return (
    <ul className="space-y-2">
      {risks.map((risk, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
          <span className="text-rose-400 mt-0.5 shrink-0">▸</span>{risk}
        </li>
      ))}
    </ul>
  )
}
