'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatMessage, type ChatMessageData } from './ChatMessage'

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  async function sendMessage() {
    const question = input.trim()
    if (!question || isStreaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error(`分析助手回應失敗（${res.status}）`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + text }
          return next
        })
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('[chat] 串流失敗:', err)
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: '[錯誤] 分析助手暫時無法回應，請稍後再試。' }
        return next
      })
    } finally {
      if (!controller.signal.aborted) setIsStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 py-4">
        {messages.length === 0 && (
          <p className="text-ghost text-sm font-mono py-12 text-center">
            問我關於歷史報告、ETF 訊號或最新新聞的問題
          </p>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        <div ref={scrollRef} />
      </div>

      <hr />

      <div className="pt-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="輸入問題…"
          disabled={isStreaming}
          className="flex-1 rounded-lg bg-lift border border-edge px-3 py-2 text-sm text-ink placeholder:text-ghost outline-none focus-visible:border-dim disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="rounded-lg bg-lift border border-edge px-4 py-2 text-sm text-ink hover:bg-edge transition-colors disabled:opacity-40 disabled:hover:bg-lift"
        >
          {isStreaming ? '思考中…' : '送出'}
        </button>
      </div>
    </div>
  )
}
