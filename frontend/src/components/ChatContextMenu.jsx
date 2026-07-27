import { useState, useEffect, useRef } from 'react'

function ChatContextMenu({ chat, position, onClose, onStar, onMarkUnread, onRename, onDelete, onAddToProject }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(chat.title)
  const menuRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== chat.title) {
      onRename(chat.id, newName.trim())
    }
    setIsRenaming(false)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
      setNewName(chat.title)
    }
  }

  const menuItems = [
    {
      label: chat.starred ? 'Desfavoritar' : 'Favoritar',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill={chat.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
      shortcut: 'P',
      onClick: () => { onStar(chat.id); onClose() }
    },
    {
      label: chat.unread ? 'Marcar como lida' : 'Marcar como não lida',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          {chat.unread && <path d="M9 12l2 2 4-4"/>}
          {!chat.unread && <path d="M12 8v4M12 16h.01"/>}
        </svg>
      ),
      shortcut: 'U',
      onClick: () => { onMarkUnread(chat.id); onClose() }
    },
    {
      label: 'Mudar o nome',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      shortcut: 'R',
      onClick: () => setIsRenaming(true)
    },
    {
      label: 'Adicionar ao projeto',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      onClick: () => { onAddToProject?.(chat.id); onClose() },
      hasSubmenu: true
    },
    { type: 'separator' },
    {
      label: 'Apagar',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      shortcut: 'D',
      danger: true,
      onClick: () => { onDelete(chat.id); onClose() }
    }
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[220px] bg-white dark:bg-bg-000 border border-gray-200 dark:border-border-200 rounded-xl shadow-lg py-1 animate-in"
      style={{ top: position.y, left: position.x }}
    >
      {isRenaming ? (
        <div className="px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRenameSubmit}
            className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-bg-200 border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-text-000"
          />
        </div>
      ) : (
        menuItems.map((item, i) => {
          if (item.type === 'separator') {
            return <div key={i} className="my-1 h-px bg-gray-100 dark:bg-border-200 mx-3" />
          }

          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-gray-700 dark:text-text-100 hover:bg-gray-50 dark:hover:bg-bg-200'
              }`}
            >
              <span className={`flex-shrink-0 ${item.danger ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-text-300'}`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <kbd className="text-xs text-gray-400 dark:text-text-300 bg-gray-100 dark:bg-bg-200 px-1.5 py-0.5 rounded">
                  {item.shortcut}
                </kbd>
              )}
              {item.hasSubmenu && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-text-300">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
            </button>
          )
        })
      )}
    </div>
  )
}

export default ChatContextMenu
