export const twd = (v: number): string => `NT$ ${Math.round(v).toLocaleString('en-US')}`

/** A per-share price without float noise (DB REAL columns return values like 103.9000015). */
export const px = (v: number): string => String(Number(v.toFixed(2)))

export const pct =(v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`

export const signedPct = (v: number): string => {
  const text = (v * 100).toFixed(1)
  if (Number(text) === 0) return '0.0%'
  return `${v > 0 ? '+' : ''}${text}%`
}
