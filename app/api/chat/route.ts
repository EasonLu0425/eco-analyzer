import { NextRequest } from 'next/server'
import { streamAgentAnswer } from '@/lib/agents/graph'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message) {
    return Response.json({ success: false, data: null, error: '訊息不可為空' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAgentAnswer(message, undefined, abortController.signal)) {
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (err) {
        if (abortController.signal.aborted) return
        console.error('[chat] agent 執行失敗:', err)
        controller.enqueue(encoder.encode('\n[錯誤] 分析助手暫時無法回應，請稍後再試。'))
      } finally {
        if (!abortController.signal.aborted) controller.close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
