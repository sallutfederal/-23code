import aiAvatar from '../assets/23codex.jpg'

function ThinkingIndicator({ status = 'thinking', label }) {
  const statusText = {
    thinking: label || 'Pensando',
    typing: label || 'Escrevendo',
    tool_call: label || 'Executando',
  }

  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
        <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
      </div>

      <div className="bg-gray-100 dark:bg-bg-100 rounded-2xl px-4 py-3 flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-text-300">
          {statusText[status] || statusText.thinking}
        </span>
        <span className="thinking-dots flex gap-[3px]">
          <span className="thinking-dot" style={{ animationDelay: '0s' }} />
          <span className="thinking-dot" style={{ animationDelay: '0.2s' }} />
          <span className="thinking-dot" style={{ animationDelay: '0.4s' }} />
        </span>
      </div>
    </div>
  )
}

export default ThinkingIndicator
