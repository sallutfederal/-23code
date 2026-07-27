import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useChat } from '../context/ChatContext'
import UserMenu from './UserMenu'
import ConfirmDialog from './ConfirmDialog'
import CustomizeModal from './CustomizeModal'
import ChatContextMenu from './ChatContextMenu'

function Sidebar({ isOpen, onClose, onNewChat, onSelectChat }) {
  const { user } = useUser()
  const { chats, activeChatId, deleteChat, starChat, markAsUnread, renameChat } = useChat()
  const [activeTab, setActiveTab] = useState('inicio')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [chatToDelete, setChatToDelete] = useState(null)
  const [hoveredChat, setHoveredChat] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `${diffDays} dias atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const groupChatsByDate = (chats) => {
    const groups = {}
    chats.forEach(chat => {
      const label = formatDate(chat.updatedAt)
      if (!groups[label]) groups[label] = []
      groups[label].push(chat)
    })
    return groups
  }

  const groupedChats = groupChatsByDate(chats)

  const handleContextMenu = (e, chat) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      chat,
      position: { x: e.clientX, y: e.clientY }
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />

      <aside className="fixed left-0 top-10 bottom-0 w-72 bg-white dark:bg-bg-100 border-r border-gray-200 dark:border-border-200 z-50 flex flex-col overflow-hidden">

        <div className="flex items-center gap-1 px-3 pt-3 pb-2">
          <button
            onClick={() => setActiveTab('inicio')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'inicio'
                ? 'bg-gray-100 dark:bg-bg-200 text-gray-900 dark:text-text-000'
                : 'text-gray-500 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Início
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-gray-100 dark:bg-bg-200 text-gray-900 dark:text-text-000'
                : 'text-gray-500 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Code
          </button>
        </div>

        <button
          onClick={onNewChat}
          className="flex items-center gap-2 mx-3 px-3 py-2 mb-2 border border-gray-200 dark:border-border-200 rounded-lg text-sm text-gray-700 dark:text-text-000 hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo
        </button>

        <div className="px-3 mb-2">
          <span className="text-xs font-medium text-gray-400 dark:text-text-300 px-1">Projetos</span>
        </div>

        <div className="px-3 mb-2">
          <div className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200 rounded cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Projetos
          </div>
          <div className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200 rounded cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Artefatos
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200 rounded cursor-pointer w-full"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Personalizar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {chats.length > 0 && (
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-gray-400 dark:text-text-300">Recentes</span>
              <div className="flex items-center gap-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9"/>
                    <path d="M4 20L21 3"/>
                  </svg>
                </button>
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="21" x2="4" y2="14"/>
                    <line x1="4" y1="10" x2="4" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12" y2="3"/>
                    <line x1="20" y1="21" x2="20" y2="16"/>
                    <line x1="20" y1="12" x2="20" y2="3"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-bg-200 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-text-300">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-text-200">Nenhum chat ainda</p>
              <p className="text-xs text-gray-400 dark:text-text-300 mt-1">Comece uma conversa!</p>
            </div>
          ) : (
            Object.entries(groupedChats).map(([dateLabel, dateChats]) => (
              <div key={dateLabel} className="mb-3">
                <div className="text-xs text-gray-400 dark:text-text-300 px-1 mb-1">{dateLabel}</div>
                <div className="space-y-0.5">
                  {dateChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group relative flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                        activeChatId === chat.id
                          ? 'bg-gray-100 dark:bg-bg-200 text-gray-900 dark:text-text-000'
                          : 'text-gray-600 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200'
                      }`}
                      onClick={() => onSelectChat(chat.id)}
                      onMouseEnter={() => setHoveredChat(chat.id)}
                      onMouseLeave={() => setHoveredChat(null)}
                    >
                      {chat.starred ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-yellow-500">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      ) : (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-300 dark:border-border-200 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-text-300"/>
                        </span>
                      )}
                      <span className={`truncate flex-1 ${chat.unread ? 'font-semibold' : ''}`}>{chat.title}</span>

                      {hoveredChat === chat.id && (
                        <button
                          onClick={(e) => handleContextMenu(e, chat)}
                          className="absolute right-1 p-1 bg-white dark:bg-bg-200 rounded hover:bg-gray-100 dark:hover:bg-bg-300 transition-colors shadow-sm"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="5" r="1"/>
                            <circle cx="12" cy="12" r="1"/>
                            <circle cx="12" cy="19" r="1"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-border-200 p-3">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-bg-200 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-bg-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-medium">{getInitials(user.name)}</span>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-text-000">{user.name}</div>
              <div className="text-xs text-gray-500 dark:text-text-200">{user.plan}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-text-300">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showUserMenu && (
            <UserMenu onClose={() => setShowUserMenu(false)} />
          )}
        </div>
      </aside>

      {chatToDelete && (
        <ConfirmDialog
          title="Excluir chat"
          message="Tem certeza que deseja excluir este chat? Esta ação não pode ser desfeita."
          onConfirm={() => {
            deleteChat(chatToDelete.id)
            setChatToDelete(null)
          }}
          onCancel={() => setChatToDelete(null)}
        />
      )}

      {contextMenu && (
        <ChatContextMenu
          chat={contextMenu.chat}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onStar={starChat}
          onMarkUnread={markAsUnread}
          onRename={renameChat}
          onDelete={(chatId) => {
            const chat = chats.find(c => c.id === chatId)
            setChatToDelete(chat)
          }}
        />
      )}

      {showCustomize && (
        <CustomizeModal onClose={() => setShowCustomize(false)} />
      )}
    </>
  )
}

export default Sidebar
