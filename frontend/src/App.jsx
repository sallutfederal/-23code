import { useState, useEffect, useRef, useCallback } from 'react'
import { UserProvider, useUser } from './context/UserContext'
import { ChatProvider, useChat } from './context/ChatContext'
import { ProjectProvider, useProject } from './context/ProjectContext'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import WelcomeScreen from './components/WelcomeScreen'
import ChatView from './components/ChatView'
import CodeView from './components/code/CodeView'
import Settings from './components/Settings'
import ConfirmDialog from './components/ConfirmDialog'
import { useActivityTrace } from './hooks/useActivityTrace'
import { parseCommand, executeCommand } from './utils/commandParser'
import { DEFAULT_MODEL } from './config/model'

function AppContent() {
  const { user, showSettings, theme } = useUser()
  const { activeChat, activeChatId, createChat, sendMessage, selectChat, newChat } = useChat()
  const { activeProject, repoMap } = useProject()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('inicio')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [loadingStatus, setLoadingStatus] = useState('idle')
  const [displayedText, setDisplayedText] = useState('')
  const typewriterRef = useRef(null)

  // --- Activity Trace ---
  const { actions, phase, totalActions, isExpanded, toggleExpand, reset: resetTrace } = useActivityTrace()

  // --- Fila de confirmações ---
  const [confirmQueue, setConfirmQueue] = useState([])
  const [currentConfirm, setCurrentConfirm] = useState(null)

  // Escuta pedidos de confirmação do main process
  useEffect(() => {
    if (!window.electronAPI?.onConfirmRequest) return

    const handler = (data) => {
      setConfirmQueue(prev => [...prev, data])
    }

    window.electronAPI.onConfirmRequest(handler)

    return () => {
      window.electronAPI.removeConfirmListener()
    }
  }, [])

  // Mostra próximo da fila quando o atual é resolvido
  useEffect(() => {
    if (!currentConfirm && confirmQueue.length > 0) {
      setCurrentConfirm(confirmQueue[0])
      setConfirmQueue(prev => prev.slice(1))
    }
  }, [currentConfirm, confirmQueue])

  const handleConfirm = useCallback(async (requestId) => {
    setCurrentConfirm(null)
    await window.electronAPI.confirmResponse(requestId, true, false)
  }, [])

  const handleDeny = useCallback(async (requestId) => {
    setCurrentConfirm(null)
    await window.electronAPI.confirmResponse(requestId, false, false)
  }, [])

  const handleAlwaysAllow = useCallback(async (requestId, scope) => {
    setCurrentConfirm(null)
    await window.electronAPI.confirmResponse(requestId, true, true, scope)
  }, [])

  // --- Tema ---
  useEffect(() => {
    const root = document.documentElement
    
    const applyTheme = (isDark) => {
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    if (theme === 'dark') {
      applyTheme(true)
    } else if (theme === 'light') {
      applyTheme(false)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(prefersDark)
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e) => applyTheme(e.matches)
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Typewriter effect com variação natural
  const startTypewriter = useCallback((text, chatId) => {
    let index = 0
    setDisplayedText('')
    setLoadingStatus('typing')

    const typeNext = () => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
        const char = text[index - 1]
        let delay = 2 + Math.random() * 4
        if (char === ' ') delay = 1 + Math.random() * 2
        else if ('.!?:'.includes(char)) delay = 5 + Math.random() * 8
        else if (',;'.includes(char)) delay = 3 + Math.random() * 5

        typewriterRef.current = setTimeout(typeNext, delay)
      } else {
        sendMessage(chatId, 'assistant', text)
        setDisplayedText('')
        setLoadingStatus('idle')
      }
    }

    typeNext()
  }, [sendMessage])

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current)
    }
  }, [])

  const handleSendMessage = async (text, attachments = []) => {
    let chatId = activeChatId

    let fullMessage = text
    if (attachments.length > 0) {
      const fileParts = attachments.map(att => {
        if (att.isImage) {
          return `[Imagem anexada: ${att.name}]\n${att.content}`
        }
        return `[Arquivo: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\``
      })
      fullMessage = text ? `${text}\n\n${fileParts.join('\n\n')}` : fileParts.join('\n\n')
    }

    if (!chatId) {
      chatId = createChat(fullMessage)
    } else {
      sendMessage(chatId, 'user', fullMessage)
    }

    // Limpar trace e iniciar nova fase
    resetTrace()
    setLoadingStatus('thinking')

    try {
      const commands = await parseCommand(text)
      
      if (commands && commands.length > 0) {
        setLoadingStatus('idle')
        for (const command of commands) {
          const result = await executeCommand(command)
          sendMessage(chatId, 'assistant', result.message || result.error)
        }
      } else {
        const currentMessages = activeChat?.messages || []
        const history = currentMessages.slice(-10)
        
        let data
        const userContext = {
          name: user.name,
          instructions: user.instructions
        }
        const modelId = selectedModel.id

        const skillMatch = text.match(/@(\S+)/)
        if (skillMatch && window.electronAPI?.readSkill) {
          const skillName = skillMatch[1]
          const result = await window.electronAPI.readSkill(`${skillName}.md`)
          if (result.success) {
            userContext.skillContent = result.data
          }
        }

        if (window.electronAPI?.knowledgePipeline) {
          try {
            const kgResult = await window.electronAPI.knowledgePipeline({
              text: fullMessage,
              projectId: activeProject?.id || 'default',
              nodeType: 'contexto_projeto',
            })
            if (kgResult.success && kgResult.data?.retrieved_context) {
              userContext.knowledgeContext = kgResult.data.retrieved_context
            }
          } catch (kgError) {
            console.log('Knowledge graph indisponível:', kgError.message)
          }
        }

        // Adicionar repo map ao contexto do agente
        if (repoMap && repoMap.files) {
          const repoMapContext = repoMap.files
            .filter(f => f.category !== 'binary' && f.category !== 'lockfile')
            .map(f => {
              if (f.signatures && f.signatures.length > 0) {
                const sigs = f.signatures
                  .map(s => `  ${s.exported ? 'export ' : ''}${s.type} ${s.name}(${s.params.join(', ')})`)
                  .join('\n')
                return `${f.relativePath}:\n${sigs}`
              } else if (f.content) {
                const truncated = f.content.slice(0, 500)
                return `${f.relativePath}:\n${truncated}${f.content.length > 500 ? '...' : ''}`
              }
              return f.relativePath
            })
            .join('\n\n')
          
          userContext.repoMap = repoMapContext
          userContext.projectPath = activeProject?.path
        }

        if (window.electronAPI) {
          const result = await window.electronAPI.sendMessage(fullMessage, history, userContext, modelId)
          data = result.data
        } else {
          const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: fullMessage, history, userContext, model: modelId })
          })
          data = await response.json()
        }

        startTypewriter(data.response, chatId)
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      setLoadingStatus('idle')
      sendMessage(chatId, 'assistant', 'Erro ao processar comando.')
    }
  }

  const handleNewChat = () => {
    newChat()
    setSidebarOpen(false)
  }

  const handleSelectChat = (chatId) => {
    selectChat(chatId)
    setSidebarOpen(false)
  }

  const messages = activeChat?.messages || []

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0a0a14]">
      <TitleBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <main className="flex-1 overflow-hidden">
          {activeTab === 'code' ? (
            <CodeView />
          ) : !activeChat ? (
            <WelcomeScreen onSendMessage={handleSendMessage} selectedModel={selectedModel} onModelChange={setSelectedModel} />
          ) : (
            <ChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              loadingStatus={loadingStatus}
              displayedText={displayedText}
              activityTrace={{ actions, phase, totalActions, isExpanded, onToggleExpand: toggleExpand }}
            />
          )}
        </main>
      </div>

      {showSettings && <Settings />}

      {/* Gate de confirmação — um modal por vez */}
      {currentConfirm && (
        <ConfirmDialog
          requestId={currentConfirm.requestId}
          action={currentConfirm.action}
          filePath={currentConfirm.filePath}
          preview={currentConfirm.preview}
          scope={currentConfirm.scope}
          onConfirm={() => handleConfirm(currentConfirm.requestId)}
          onDeny={() => handleDeny(currentConfirm.requestId)}
          onAlwaysAllow={(scope) => handleAlwaysAllow(currentConfirm.requestId, scope)}
          timeout={currentConfirm.timeout}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <UserProvider>
      <ChatProvider>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </ChatProvider>
    </UserProvider>
  )
}

export default App
