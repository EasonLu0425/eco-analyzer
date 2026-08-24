import type { NewsItem } from '@/types'

export function buildPrompt(items: NewsItem[]): string {
  const headlines = items
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}`)
    .join('\n')

  return `你是一位資深的台灣財經分析師，專精科技股 ETF 投資。
以下是今日蒐集到的財經新聞標題（共 ${items.length} 則）：

${headlines}

請分析上述新聞，評估當前市場環境，以 **繁體中文** 和 **純 JSON 格式** 回覆（不要有任何其他文字）：

{
  "sentimentScore": <整數或小數，0到10，10代表最樂觀>,
  "signal": <"strong-buy" | "buy" | "hold" | "avoid" | "strong-avoid">,
  "summary": <100字內的市場趨勢摘要，繁體中文>,
  "risks": [<風險因素1>, <風險因素2>, <風險因素3>],
  "topHeadlines": [<最重要的5則標題，直接從輸入挑選>]
}

判斷邏輯（區間互斥，signal 必須嚴格對應 sentimentScore）：
- strong-buy（8.5-10分）：利多消息明顯且罕見，科技股動能強勁，非多空交織
- buy（7-8.49分）：明確偏正面，多項利多、風險有限
- hold（4-6.99分）：多空交織或訊息不足，建議觀望——這是預設區間，沒有明確理由不要偏離
- avoid（2-3.99分）：風險增加，謹慎為宜
- strong-avoid（0-1.99分）：市場明顯轉弱，避免進場

務必保守評分：多數平淡、混雜的新聞應落在 hold（4-7分），只有在利多訊息明確且一致時才給 7 分以上。不要因為單一正面新聞就給高分。`
}
