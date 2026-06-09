export function HeadlineList({ headlines }: { headlines: string[] }) {
  return (
    <ol className="space-y-3">
      {headlines.map((h, i) => (
        <li key={i} className="flex items-start gap-3 group">
          <span className="font-mono text-xs text-slate-600 mt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
          <span className="text-sm text-slate-400 leading-relaxed line-clamp-2 group-hover:text-slate-300 transition-colors">{h}</span>
        </li>
      ))}
    </ol>
  )
}
