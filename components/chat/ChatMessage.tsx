export interface ChatMessageData {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageData) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[75%] rounded-lg bg-lift px-4 py-2.5 text-[0.9375rem] text-ink'
            : 'max-w-[85%] rounded-lg px-4 py-2.5 text-[0.9375rem] text-dim leading-relaxed whitespace-pre-wrap'
        }
      >
        {content || (isUser ? '' : '…')}
      </div>
    </div>
  )
}
