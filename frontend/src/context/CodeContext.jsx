import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useProject } from './ProjectContext'

const CodeContext = createContext()

// Limite de tamanho para edição no Monaco (3MB)
const MAX_EDITABLE_SIZE = 3 * 1024 * 1024

// Extensões de código conhecidas (mapeamento para linguagens do Monaco)
const EXTENSION_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'html', '.svg': 'html',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql', '.graphql': 'graphql',
  '.md': 'markdown', '.mdx': 'markdown',
  '.env': 'plaintext', '.ini': 'ini', '.cfg': 'ini',
  '.dockerfile': 'dockerfile', '.docker': 'dockerfile',
}

// Arquivos sensíveis (espelha blocklist do backend)
const SENSITIVE_PATTERNS = [
  /^\.env$/i, /^\.env\./i,
  /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i,
  /^id_rsa/i, /^id_ed25519/i, /^id_dsa/i, /^id_ecdsa/i,
  /credentials\.json$/i, /service.*account.*\.json$/i,
  /\.npmrc$/i, /\.pypirc$/i, /htpasswd/i,
  /\.secret$/i, /\.secrets$/i,
]

function isSensitiveFile(filePath) {
  const basename = filePath.split(/[/\\]/).pop()
  return SENSITIVE_PATTERNS.some(p => p.test(basename))
}

/**
 * Detecta linguagem a partir do nome do arquivo.
 * Retorna string compatível com Monaco Editor.
 */
function detectLanguage(filePath) {
  const name = filePath.split(/[/\\]/).pop().toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  if (name === '.gitignore') return 'plaintext'

  const ext = '.' + name.split('.').pop()
  return EXTENSION_MAP[ext] || 'plaintext'
}

/**
 * Constrói árvore hierárquica a partir da lista plana de arquivos do repoMap.
 */
function buildTree(files, projectPath) {
  const root = { name: projectPath.split(/[/\\]/).pop() || 'Projeto', path: projectPath, isDir: true, children: [] }

  const sorted = [...files].sort((a, b) => {
    const aIsDir = a.relativePath.includes('/')
    const bIsDir = b.relativePath.includes('/')
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.relativePath.localeCompare(b.relativePath)
  })

  for (const file of sorted) {
    const parts = file.relativePath.split('/')
    let current = root

    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      let child = current.children.find(c => c.name === dirName && c.isDir)
      if (!child) {
        child = {
          name: dirName,
          path: projectPath + '/' + parts.slice(0, i + 1).join('/'),
          isDir: true,
          children: []
        }
        current.children.push(child)
      }
      current = child
    }

    const fileName = parts[parts.length - 1]
    current.children.push({
      name: fileName,
      path: file.path,
      relativePath: file.relativePath,
      isDir: false,
      size: file.size,
      extension: file.extension,
      category: file.category,
      sensitive: isSensitiveFile(file.path),
      language: detectLanguage(file.path),
      tooLarge: (file.size || 0) > MAX_EDITABLE_SIZE,
    })
  }

  return root
}

/**
 * Tab object shape:
 * {
 *   path, name, language, content, loading, error, sensitive, modified,
 *   dirty,           // true se buffer difere do conteúdo salvo em disco
 *   editedContent,   // buffer em memória (o que o usuário está editando)
 *   originalContent, // conteúdo original do disco (para comparar dirty)
 *   tooLarge,        // arquivo grande demais para Monaco (read-only)
 *   conflict,        // true se agente editou enquanto havia dirty
 *   agentContent,    // conteúdo da versão do agente (para exibir no conflito)
 * }
 */
export function CodeProvider({ children }) {
  const { repoMap, activeProject } = useProject()

  // --- Árvore ---
  const [treeData, setTreeData] = useState(null)
  const [expandedDirs, setExpandedDirs] = useState(new Set())

  useEffect(() => {
    if (repoMap?.files && activeProject?.path) {
      const tree = buildTree(repoMap.files, activeProject.path)
      setTreeData(tree)
    } else {
      setTreeData(null)
    }
  }, [repoMap, activeProject])

  // --- Tabs ---
  const [openTabs, setOpenTabs] = useState([])
  const [activeTabPath, setActiveTabPath] = useState(null)

  // --- Debounce para notificações do agente ---
  // Map<path, Timeout> — agrupa múltiplas edições rápidas numa só atualização
  const pendingNotifications = useRef(new Map())

  /**
   * Abre um arquivo em nova tab (ou foca tab existente).
   */
  const openFile = useCallback(async (filePath, fileName, sensitive, language, tooLarge) => {
    const existing = openTabs.find(t => t.path === filePath)
    if (existing) {
      setActiveTabPath(filePath)
      return
    }

    const newTab = {
      path: filePath,
      name: fileName,
      language: language || 'plaintext',
      content: null,
      loading: !sensitive,
      error: null,
      sensitive: !!sensitive,
      modified: false,
      dirty: false,
      editedContent: null,
      originalContent: null,
      tooLarge: !!tooLarge,
      conflict: false,
      agentContent: null,
    }

    setOpenTabs(prev => [...prev, newTab])
    setActiveTabPath(filePath)

    if (sensitive) return

    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        setOpenTabs(prev => prev.map(t =>
          t.path === filePath ? {
            ...t,
            content: result.data,
            originalContent: result.data,
            loading: false
          } : t
        ))
      } else {
        setOpenTabs(prev => prev.map(t =>
          t.path === filePath ? { ...t, error: result.error || 'Erro ao ler arquivo', loading: false } : t
        ))
      }
    } catch (err) {
      setOpenTabs(prev => prev.map(t =>
        t.path === filePath ? { ...t, error: err.message, loading: false } : t
      ))
    }
  }, [openTabs])

  /**
   * Fecha uma tab. Se tiver alterações não salvas, retorna true para
   * o componente pai mostrar confirmação antes de fechar de fato.
   * Retorna false se pode fechar direto.
   */
  const requestCloseTab = useCallback((filePath) => {
    const tab = openTabs.find(t => t.path === filePath)
    if (tab?.dirty) {
      return true // Precisa de confirmação
    }
    // Pode fechar direto
    performCloseTab(filePath)
    return false
  }, [openTabs, activeTabPath])

  const performCloseTab = useCallback((filePath) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath)
      const next = prev.filter(t => t.path !== filePath)

      if (filePath === activeTabPath && next.length > 0) {
        const newIdx = Math.min(idx, next.length - 1)
        setActiveTabPath(next[newIdx].path)
      } else if (next.length === 0) {
        setActiveTabPath(null)
      }

      return next
    })
  }, [activeTabPath])

  const setActiveTab = useCallback((filePath) => {
    setActiveTabPath(filePath)
  }, [])

  /**
   * Atualiza o buffer de edição (chamado pelo Monaco onChange).
   */
  const updateEditedContent = useCallback((filePath, newContent) => {
    setOpenTabs(prev => prev.map(t => {
      if (t.path !== filePath) return t
      const dirty = newContent !== t.originalContent
      return { ...t, editedContent: newContent, dirty }
    }))
  }, [])

  /**
   * Salva o conteúdo do buffer em disco (Ctrl+S).
   * SEM gate de confirmação — é ação direta do usuário.
   */
  const saveFile = useCallback(async (filePath) => {
    const tab = openTabs.find(t => t.path === filePath)
    if (!tab || !tab.dirty || tab.sensitive) return { success: false, error: 'Nada para salvar' }

    try {
      const result = await window.electronAPI.writeFileContent(filePath, tab.editedContent)
      if (result.success) {
        setOpenTabs(prev => prev.map(t =>
          t.path === filePath ? {
            ...t,
            content: t.editedContent,
            originalContent: t.editedContent,
            dirty: false,
            modified: false,
          } : t
        ))
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [openTabs])

  /**
   * Descarta alterações não salvas e recarrega do disco.
   */
  const discardChanges = useCallback(async (filePath) => {
    try {
      const result = await window.electronAPI.readFile(filePath)
      setOpenTabs(prev => prev.map(t => {
        if (t.path !== filePath) return t
        if (result.success) {
          return {
            ...t,
            content: result.data,
            originalContent: result.data,
            editedContent: null,
            dirty: false,
            modified: false,
            conflict: false,
            agentContent: null,
          }
        }
        return t
      }))
    } catch (err) {
      console.error('Erro ao descartar alterações:', err)
    }
  }, [])

  /**
   * Recarrega o conteúdo de uma tab (ex: após edição externa sem dirty).
   */
  const reloadFile = useCallback(async (filePath) => {
    setOpenTabs(prev => prev.map(t => {
      if (t.path !== filePath || t.sensitive) return t
      return { ...t, loading: true, error: null, modified: false }
    }))

    try {
      const result = await window.electronAPI.readFile(filePath)
      setOpenTabs(prev => prev.map(t => {
        if (t.path !== filePath) return t
        if (result.success) {
          return {
            ...t,
            content: result.data,
            originalContent: result.data,
            editedContent: null,
            loading: false,
            error: null,
            modified: false,
            dirty: false,
            conflict: false,
            agentContent: null,
          }
        }
        return { ...t, error: result.error || 'Erro ao recarregar', loading: false, modified: false }
      }))
    } catch (err) {
      setOpenTabs(prev => prev.map(t =>
        t.path === filePath ? { ...t, error: err.message, loading: false, modified: false } : t
      ))
    }
  }, [])

  /**
   * Notifica que um arquivo aberto foi modificado externamente (pelo agente).
   * Debounce de 400ms: agrupa múltiplas edições rápidas numa só atualização.
   *
   * Mecanismo:
   * - Cada path tem um timer associado no Map pendingNotifications
   * - Se chega nova notificação para o mesmo path, cancela timer anterior e cria novo
   * - Quando o timer dispara (400ms sem nova notificação):
   *   - Lê conteúdo atualizado do disco
   *   - Se tab não tem dirty: atualiza conteúdo automaticamente
   *   - Se tab tem dirty: marca conflito (não sobrescreve)
   */
  const notifyFileChanged = useCallback((filePath) => {
    // Limpar timer anterior deste path (se existir)
    const existingTimer = pendingNotifications.current.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Criar novo timer de 400ms
    const timer = setTimeout(async () => {
      pendingNotifications.current.delete(filePath)

      // Ler conteúdo atualizado do disco
      try {
        const result = await window.electronAPI.readFile(filePath)
        if (!result.success) return

        const newContent = result.data

        setOpenTabs(prev => prev.map(t => {
          if (t.path !== filePath) return t

          // Se não tem dirty: atualização automática
          if (!t.dirty) {
            return {
              ...t,
              content: newContent,
              originalContent: newContent,
              modified: true,
            }
          }

          // Se tem dirty: conflito — não sobrescrever
          return {
            ...t,
            conflict: true,
            agentContent: newContent,
            modified: true,
          }
        }))
      } catch (err) {
        console.error('Erro ao processar notificação de mudança:', err)
      }
    }, 400)

    pendingNotifications.current.set(filePath, timer)
  }, [])

  /**
   * Notifica que um arquivo aberto foi deletado (pelo agente).
   */
  const notifyFileDeleted = useCallback((filePath) => {
    // Cancelar debounce pendente
    const existingTimer = pendingNotifications.current.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
      pendingNotifications.current.delete(filePath)
    }

    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath)
      if (filePath === activeTabPath) {
        if (next.length > 0) {
          const idx = prev.findIndex(t => t.path === filePath)
          setActiveTabPath(next[Math.min(idx, next.length - 1)].path)
        } else {
          setActiveTabPath(null)
        }
      }
      return next
    })
  }, [activeTabPath])

  /**
   * Resolve conflito: usar versão do agente (descarta dirty do usuário).
   */
  const acceptAgentChanges = useCallback(async (filePath) => {
    const tab = openTabs.find(t => t.path === filePath)
    if (!tab?.agentContent) return

    try {
      // Salvar conteúdo do agente em disco
      const saveResult = await window.electronAPI.writeFileContent(filePath, tab.agentContent)
      if (saveResult.success) {
        setOpenTabs(prev => prev.map(t =>
          t.path === filePath ? {
            ...t,
            content: tab.agentContent,
            originalContent: tab.agentContent,
            editedContent: null,
            dirty: false,
            modified: false,
            conflict: false,
            agentContent: null,
          } : t
        ))
      }
    } catch (err) {
      console.error('Erro ao aceitar mudança do agente:', err)
    }
  }, [openTabs])

  /**
   * Resolve conflito: manter alterações do usuário (ignorar versão do agente).
   */
  const rejectAgentChanges = useCallback((filePath) => {
    setOpenTabs(prev => prev.map(t =>
      t.path === filePath ? {
        ...t,
        conflict: false,
        agentContent: null,
      } : t
    ))
  }, [])

  // --- Expansão de pastas ---
  const toggleDir = useCallback((dirPath) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })
  }, [])

  // Tab ativa (objeto derivado)
  const activeTab = useMemo(() => {
    return openTabs.find(t => t.path === activeTabPath) || null
  }, [openTabs, activeTabPath])

  return (
    <CodeContext.Provider value={{
      treeData,
      expandedDirs,
      toggleDir,
      openTabs,
      activeTabPath,
      activeTab,
      openFile,
      requestCloseTab,
      performCloseTab,
      setActiveTab,
      updateEditedContent,
      saveFile,
      discardChanges,
      reloadFile,
      notifyFileChanged,
      notifyFileDeleted,
      acceptAgentChanges,
      rejectAgentChanges,
    }}>
      {children}
    </CodeContext.Provider>
  )
}

export function useCode() {
  const ctx = useContext(CodeContext)
  if (!ctx) throw new Error('useCode must be used within CodeProvider')
  return ctx
}
