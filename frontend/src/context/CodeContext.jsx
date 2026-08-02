import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useProject } from './ProjectContext'

const CodeContext = createContext()

// Extensões de código conhecidas (mapeamento para linguagens do syntax highlighter)
const EXTENSION_MAP = {
  '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'tsx',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'html', '.svg': 'html',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.sql': 'sql', '.graphql': 'graphql',
  '.md': 'markdown', '.mdx': 'markdown',
  '.env': 'bash', '.ini': 'ini', '.cfg': 'ini',
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
 * Retorna string compatível com react-syntax-highlighter.
 */
function detectLanguage(filePath) {
  const name = filePath.split(/[/\\]/).pop().toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  if (name === '.gitignore') return 'bash'

  const ext = '.' + name.split('.').pop()
  return EXTENSION_MAP[ext] || 'text'
}

/**
 * Constrói árvore hierárquica a partir da lista plana de arquivos do repoMap.
 * Retorna: { name, path, isDir, children[] }
 *
 * A árvore é construída uma vez quando o repoMap muda e armazenada em estado.
 */
function buildTree(files, projectPath) {
  const root = { name: projectPath.split(/[/\\]/).pop() || 'Projeto', path: projectPath, isDir: true, children: [] }

  // Ordenar: pastas primeiro, depois arquivos, alfabético
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

    // Navegar/criar diretórios
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

    // Adicionar arquivo
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
    })
  }

  return root
}

export function CodeProvider({ children }) {
  const { repoMap, activeProject } = useProject()

  // --- Árvore ---
  const [treeData, setTreeData] = useState(null)
  const [expandedDirs, setExpandedDirs] = useState(new Set())

  // Reconstruir árvore quando repoMap muda
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

  /**
   * Abre um arquivo em nova tab (ou foca tab existente).
   * Se o arquivo é sensível, marca como blocked em vez de ler conteúdo.
   */
  const openFile = useCallback(async (filePath, fileName, sensitive, language) => {
    // Se já está aberto, apenas focar
    const existing = openTabs.find(t => t.path === filePath)
    if (existing) {
      setActiveTabPath(filePath)
      return
    }

    // Criar tab com loading
    const newTab = {
      path: filePath,
      name: fileName,
      language: language || 'text',
      content: null,
      loading: !sensitive,
      error: null,
      sensitive: !!sensitive,
      modified: false,
    }

    setOpenTabs(prev => [...prev, newTab])
    setActiveTabPath(filePath)

    if (sensitive) return

    // Ler conteúdo via IPC
    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        setOpenTabs(prev => prev.map(t =>
          t.path === filePath ? { ...t, content: result.data, loading: false } : t
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
   * Fecha uma tab.
   * Se for a tab ativa, foca a vizinha (direita, depois esquerda).
   */
  const closeTab = useCallback((filePath) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath)
      const next = prev.filter(t => t.path !== filePath)

      // Se fechou a tab ativa, focar a vizinha
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
   * Recarrega o conteúdo de uma tab (ex: após edição externa).
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
          return { ...t, content: result.data, loading: false, error: null, modified: false }
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
   * Mostra indicador visual sem sobrescrever conteúdo.
   */
  const notifyFileChanged = useCallback((filePath) => {
    setOpenTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, modified: true } : t
    ))
  }, [])

  /**
   * Notifica que um arquivo aberto foi deletado (pelo agente).
   * Fecha a tab automaticamente.
   */
  const notifyFileDeleted = useCallback((filePath) => {
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
      closeTab,
      setActiveTab,
      reloadFile,
      notifyFileChanged,
      notifyFileDeleted,
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
