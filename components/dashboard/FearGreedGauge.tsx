import type { FearGreedIndex } from '@/types'

const LABEL_ZH: Record<string, string> = {
  'extreme-fear': '極度恐懼',
  'fear':         '恐懼',
  'neutral':      '中性',
  'greed':        '貪婪',
  'extreme-greed':'極度貪婪',
}

const LABEL_COLOR: Record<string, string> = {
  'extreme-fear': '#f43f5e',
  'fear':         '#fb923c',
  'neutral':      '#f59e0b',
  'greed':        '#10b981',
  'extreme-greed':'#06d6a0',
}

export function FearGreedGauge({ fearGreed }: { fearGreed: FearGreedIndex }) {
  const { score, label, components } = fearGreed
  const color = LABEL_COLOR[label] ?? '#f59e0b'

  // Semicircle gauge: left(score=0) → top(50) → right(100)
  const cx = 80, cy = 75, r = 56
  const angle = (1 - score / 100) * Math.PI
  const px = cx + r * Math.cos(angle)
  const py = cy - r * Math.sin(angle)
  // Fill arc from left to needle is always ≤ 180° → largeArc always 0
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const fill = score === 0
    ? ''
    : `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}`

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 160 90" className="w-36 h-20">
        <path d={track} fill="none" stroke="#1a1a1a" strokeWidth="10" strokeLinecap="round" />
        {fill && <path d={fill} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
        <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r="5" fill={color} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
      <p className="font-mono text-xs" style={{ color }}>{LABEL_ZH[label] ?? label}</p>
      <p className="font-mono text-[10px] text-zinc-500">
        情緒 {components.sentiment} · 52w {components.weeklyPosition} · 動能 {components.momentum}
      </p>
    </div>
  )
}
