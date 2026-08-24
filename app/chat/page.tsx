import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ChatPage() {
  return (
    <div>
      <p className="font-mono text-xs text-ghost pb-5">互動式分析助手</p>
      <hr />
      <div className="pt-2">
        <ChatWindow />
      </div>
    </div>
  )
}
