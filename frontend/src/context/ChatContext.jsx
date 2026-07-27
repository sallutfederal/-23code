import { createContext, useContext, useState, useEffect } from 'react'

const ChatContext = createContext()

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function ChatProvider({ children }) {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('chat-history')
    return saved ? JSON.parse(saved) : []
  })

  const [activeChatId, setActiveChatId] = useState(null)

  useEffect(() => {
    localStorage.setItem('chat-history', JSON.stringify(chats))
  }, [chats])

  const createChat = (firstMessage) => {
    const chat = {
      id: generateId(),
      title: firstMessage.slice(0, 50),
      messages: firstMessage ? [{ role: 'user', content: firstMessage }] : [],
      starred: false,
      unread: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setChats(prev => [chat, ...prev])
    setActiveChatId(chat.id)
    return chat.id
  }

  const sendMessage = (chatId, role, content) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat
      return {
        ...chat,
        messages: [...chat.messages, { role, content }],
        updatedAt: new Date().toISOString()
      }
    }))
  }

  const deleteChat = (chatId) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    if (activeChatId === chatId) {
      setActiveChatId(null)
    }
  }

  const starChat = (chatId) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat
      return { ...chat, starred: !chat.starred }
    }))
  }

  const markAsUnread = (chatId) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat
      return { ...chat, unread: !chat.unread }
    }))
  }

  const renameChat = (chatId, newTitle) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat
      return { ...chat, title: newTitle }
    }))
  }

  const getActiveChat = () => {
    return chats.find(chat => chat.id === activeChatId) || null
  }

  const selectChat = (chatId) => {
    setActiveChatId(chatId)
  }

  const newChat = () => {
    setActiveChatId(null)
  }

  return (
    <ChatContext.Provider value={{
      chats,
      activeChatId,
      activeChat: getActiveChat(),
      createChat,
      sendMessage,
      deleteChat,
      starChat,
      markAsUnread,
      renameChat,
      selectChat,
      newChat
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
