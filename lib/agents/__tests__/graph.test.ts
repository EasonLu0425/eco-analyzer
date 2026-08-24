import { describe, it, expect } from 'vitest'
import { AIMessage, type BaseMessage, ToolMessage } from '@langchain/core/messages'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ChatResult } from '@langchain/core/outputs'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createAnalysisAgent, askAgent, streamAgentAnswer } from '@/lib/agents/graph'

class ScriptedChatModel extends BaseChatModel {
  calls: BaseMessage[][] = []
  private step = 0

  constructor(private responses: AIMessage[]) {
    super({})
  }

  _llmType() {
    return 'scripted-fake'
  }

  bindTools() {
    return this
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.calls.push(messages)
    const message = this.responses[Math.min(this.step, this.responses.length - 1)]
    this.step += 1
    return { generations: [{ text: typeof message.content === 'string' ? message.content : '', message }] }
  }
}

describe('createAnalysisAgent', () => {
  it('calls the matching tool then answers using the tool result', async () => {
    const mockTool = tool(async () => JSON.stringify([{ date: '2026-01-02', signal: 'buy' }]), {
      name: 'query_reports_by_signal',
      description: 'mock',
      schema: z.object({ signal: z.string(), limit: z.number().optional() }),
    })
    const model = new ScriptedChatModel([
      new AIMessage({
        content: '',
        tool_calls: [{ name: 'query_reports_by_signal', args: { signal: 'buy', limit: 5 }, id: 'call_1' }],
      }),
      new AIMessage({ content: '根據查詢，2026-01-02 為 buy 訊號。' }),
    ])

    const agent = createAnalysisAgent(model, [mockTool])
    const answer = await askAgent('最近有沒有 buy 訊號？', agent)

    expect(answer).toContain('buy 訊號')
    expect(model.calls).toHaveLength(2)

    const secondCallMessages = model.calls[1]
    const toolMessage = secondCallMessages.find((m): m is ToolMessage => m instanceof ToolMessage)
    expect(toolMessage?.content).toContain('"signal":"buy"')
  })

  it('answers directly without tool calls when none are needed', async () => {
    const model = new ScriptedChatModel([new AIMessage({ content: '你好，我是分析助手。' })])
    const agent = createAnalysisAgent(model, [])

    const answer = await askAgent('你好', agent)

    expect(answer).toBe('你好，我是分析助手。')
    expect(model.calls).toHaveLength(1)
  })
})

describe('streamAgentAnswer', () => {
  it('yields text chunks for the final answer after a tool round-trip', async () => {
    const mockTool = tool(async () => JSON.stringify([{ date: '2026-01-02', signal: 'buy' }]), {
      name: 'query_reports_by_signal',
      description: 'mock',
      schema: z.object({ signal: z.string(), limit: z.number().optional() }),
    })
    const model = new ScriptedChatModel([
      new AIMessage({
        content: '',
        tool_calls: [{ name: 'query_reports_by_signal', args: { signal: 'buy', limit: 5 }, id: 'call_1' }],
      }),
      new AIMessage({ content: '根據查詢，2026-01-02 為 buy 訊號。' }),
    ])
    const agent = createAnalysisAgent(model, [mockTool])

    const chunks: string[] = []
    for await (const chunk of streamAgentAnswer('最近有沒有 buy 訊號？', agent)) {
      chunks.push(chunk)
    }

    expect(chunks.join('')).toBe('根據查詢，2026-01-02 為 buy 訊號。')
  })

  it('yields nothing but completes when the model returns empty content', async () => {
    const model = new ScriptedChatModel([new AIMessage({ content: '' })])
    const agent = createAnalysisAgent(model, [])

    const chunks: string[] = []
    for await (const chunk of streamAgentAnswer('...', agent)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([])
  })
})
