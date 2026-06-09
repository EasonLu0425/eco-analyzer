export function SentimentMeter({ score }: { score: number }) {
  const size = 140
  const r = 54
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const filled = (score / 10) * circumference
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#f43f5e'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" fill="white" fontSize="26" fontWeight="bold" fontFamily="monospace">{score.toFixed(1)}</text>
        <text x={cx} y={cx + 16} textAnchor="middle" fill="#64748b" fontSize="11">/10</text>
      </svg>
      <span className="text-slate-500 text-xs uppercase tracking-wider">情緒分數</span>
    </div>
  )
}
