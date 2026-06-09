import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt } from './prompt'
import type { NewsItem, AnalysisReport, ETFSignal } from '@/types'

type AnalysisResult = Omit<AnalysisReport, 'id' | 'date' | 'createdAt'>

const SAFE_DEFAULT: AnalysisResult = {
  sentimentScore: 5,
  signal: 'hold',
  summary: '分析服務暫時無法使用，請稍後再試。',
  risks: ['無法取得分析結果', '請確認 API 金鑰設定', '稍後再試'],
  topHeadlines: [],
  newsCount: 0,
}

export async function analyzeNews(items: NewsItem[]): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[analyzer] ANTHROPIC_API_KEY 未設定，回傳預設值')
    return { ...SAFE_DEFAULT, newsCount: items.length }
  }

  const client = new Anthropic()
  const prompt = buildPrompt(items)

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('回應中找不到 JSON 內容')

    const parsed = JSON.parse(jsonMatch[0]) as {
      sentimentScore: number
      signal: ETFSignal
      summary: string
      risks: string[]
      topHeadlines: string[]
    }

    return {
      sentimentScore: Math.min(10, Math.max(0, Number(parsed.sentimentScore))),
      signal: parsed.signal,
      summary: parsed.summary ?? '',
      risks: (parsed.risks ?? []).slice(0, 3),
      topHeadlines: (parsed.topHeadlines ?? []).slice(0, 5),
      newsCount: items.length,
    }
  } catch (err) {
    console.error('[analyzer] 分析失敗:', err)
    return { ...SAFE_DEFAULT, newsCount: items.length }
  }
}

// dry-run test
if (process.argv[1] && process.argv[1].includes('claude.ts')) {
  const mockItems: NewsItem[] = [
    { title: 'NVIDIA 財報超預期，帶動那斯達克走強', description: '', url: '', publishedAt: new Date().toISOString(), source: '測試' },
    { title: '聯準會暗示年內可能降息，科技股普遍上漲', description: '', url: '', publishedAt: new Date().toISOString(), source: '測試' },
    { title: '台積電法說會：下半年展望樂觀', description: '', url: '', publishedAt: new Date().toISOString(), source: '測試' },
  ]
  console.log('=== 生成的 Prompt ===')
  console.log(buildPrompt(mockItems))
  console.log('\n=== 執行分析（無 API Key 時回傳預設值）===')
  analyzeNews(mockItems).then(r => console.log(JSON.stringify(r, null, 2)))
}
