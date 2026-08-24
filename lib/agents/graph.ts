import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, isAIMessage } from '@langchain/core/messages'
import type { LanguageModelLike } from '@langchain/core/language_models/base'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { agentTools } from './tools'

const SYSTEM_PROMPT = `你是 EcoNews 的財經分析助手，協助使用者理解每日 ETF 訊號與歷史報告脈絡。
回答時優先使用工具查詢資料庫中的歷史報告或最新新聞，不要憑空捏造數字或日期。
回覆使用繁體中文，簡潔具體。`

export type AnalysisAgent = ReturnType<typeof createReactAgent>

export function createAnalysisAgent(
  llm: LanguageModelLike = new ChatAnthropic({ model: 'claude-haiku-4-5-20251001' }),
  tools: StructuredToolInterface[] = agentTools,
): AnalysisAgent {
  return createReactAgent({ llm, tools, prompt: SYSTEM_PROMPT })
}

export async function askAgent(
  question: string,
  agent: AnalysisAgent = createAnalysisAgent(),
): Promise<string> {
  const result = await agent.invoke({ messages: [new HumanMessage(question)] })
  const last = result.messages[result.messages.length - 1]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content)
}

export async function* streamAgentAnswer(
  question: string,
  agent: AnalysisAgent = createAnalysisAgent(),
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const events = await agent.stream(
    { messages: [new HumanMessage(question)] },
    { streamMode: 'messages', signal },
  )
  for await (const [chunk, metadata] of events) {
    if (!isAIMessage(chunk)) continue
    if ((metadata as { langgraph_node?: string })?.langgraph_node !== 'agent') continue
    const text = typeof chunk.content === 'string' ? chunk.content : ''
    if (text) yield text
  }
}
