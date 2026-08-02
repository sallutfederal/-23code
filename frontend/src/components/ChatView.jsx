import { useRef, useEffect } from 'react'
import ChatInput from './ChatInput'
import Message from './Message'
import ThinkingIndicator from './ThinkingIndicator'
import ActivityTrace from './ActivityTrace'
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

function ChatView({ messages, onSendMessage, selectedModel, onModelChange, loadingStatus, displayedText, activityTrace }) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingStatus, displayedText, activityTrace?.actions])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <Message key={i} message={msg} />
          ))}

          {/* Activity Trace — exibe ações de tools em tempo real */}
          {activityTrace && activityTrace.actions.length > 0 && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
                <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <ActivityTrace
                  actions={activityTrace.actions}
                  phase={activityTrace.phase}
                  totalActions={activityTrace.totalActions}
                  isExpanded={activityTrace.isExpanded}
                  onToggleExpand={activityTrace.onToggleExpand}
                />
              </div>
            </div>
          )}

          {/* Indicador de thinking/digitando (só aparece quando NÃO tem trace ou trace terminou) */}
          {loadingStatus === 'thinking' && (!activityTrace || activityTrace.actions.length === 0) && (
            <ThinkingIndicator status="thinking" />
          )}

          {/* Indicador "Pensando" quando trace mostra fase thinking e está colapsado */}
          {activityTrace && activityTrace.phase === 'thinking' && !activityTrace.isExpanded && activityTrace.actions.length > 0 && (
            <ThinkingIndicator status="thinking" label={`${activityTrace.totalActions} ações executadas — Pensando`} />
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
