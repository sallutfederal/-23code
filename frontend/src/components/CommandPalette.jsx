import { useState, useEffect, useRef } from 'react'
import { useChat } from '../context/ChatContext'

function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const { chats, selectChat } = useChat()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(query.toLowerCase()) ||
    chat.messages.some(m => m.content.toLowerCase().includes(query.toLowerCase()))
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredChats.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredChats[selectedIndex]) {
      e.preventDefault()
      selectChat(filteredChats[selectedIndex].id)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-white dark:bg-bg-100 rounded-xl shadow-2xl border border-gray-200 dark:border-border-300 overflow-hidden"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-border-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               className="text-gray-400 dark:text-text-300 flex-shrink-0">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input ref={inputRef}
                 type="text"
                 placeholder="Buscar conversas..."
                 value={query}
                 onChange={e => setQuery(e.target.value)}
                 onKeyDown={handleKeyDown}
                 className="flex-1 bg-transparent outline-none text-gray-900 dark:text-text-100 placeholder-gray-400 dark:placeholder-text-300" />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-text-300 bg-gray-100 dark:bg-bg-200 rounded border border-gray-200 dark:border-border-300">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[40vh] overflow-y-auto p-1">
          {filteredChats.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-text-300 text-sm">
              {query ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </div>
          ) : (
            filteredChats.map((chat, index) => (
              <button key={chat.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-gray-100 dark:bg-bg-200'
                          : 'hover:bg-gray-50 dark:hover:bg-bg-200/50'
                      }`}
                      onClick={() => {
                        selectChat(chat.id)
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}>
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-bg-200 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       className="text-gray-500 dark:text-text-300">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-text-100 truncate">
                    {chat.title}
                  </div>
                  {chat.messages.length > 0 && (
                    <div className="text-xs text-gray-400 dark:text-text-300 truncate mt-0.5">
                      {chat.messages[chat.messages.length - 1].content.slice(0, 60)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {chat.starred && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                         className="text-amber-400">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                  <span className="text-[10px] text-gray-400 dark:text-text-300">
                    {formatDate(chat.updatedAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-border-300 text-[10px] text-gray-400 dark:text-text-300">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-bg-200 rounded border border-gray-200 dark:border-border-300">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-bg-200 rounded border border-gray-200 dark:border-border-300">↵</kbd>
              abrir
            </span>
          </div>
          <span>{filteredChats.length} conversa{filteredChats.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
