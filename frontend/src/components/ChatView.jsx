import { useRef, useEffect } from 'react'
import ChatInput from './ChatInput'
import Message from './Message'
import ThinkingIndicator from './ThinkingIndicator'
import { useUser } from '../context/UserContext'
import aiAvatar from '../assets/23codex.jpg'

function TypingMessage({ text }) {
  const { user } = useUser()

  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
        <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
      </div>
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-bg-100 text-gray-800 dark:text-text-200">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {text}
          <span className="typing-cursor" />
        </p>
      </div>
    </div>
  )
}

function ChatView({ messages, onSendMessage, selectedModel, onModelChange, loadingStatus, displayedText }) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingStatus, displayedText])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <Message key={i} message={msg} />
          ))}

          {/* Indicador de thinking/digitando */}
          {loadingStatus === 'thinking' && (
            <ThinkingIndicator status="thinking" />
          )}

          {/* Mensagem sendo digitada com cursor */}
          {loadingStatus === 'typing' && displayedText && (
            <TypingMessage text={displayedText} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 dark:border-border-300 bg-white dark:bg-bg-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ChatInput
            onSend={onSendMessage}
            placeholder="Continuar a conversa..."
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            disabled={loadingStatus !== 'idle'}
          />
        </div>
      </div>
    </div>
  )
}

export default ChatView
