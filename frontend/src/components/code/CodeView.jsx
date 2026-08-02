import { useState, useCallback, useEffect, useRef } from 'react'
import { CodeProvider, useCode } from '../../context/CodeContext'
import { useProject } from '../../context/ProjectContext'
import { useFileWatcher } from '../../hooks/useFileWatcher'
import FileTree from './FileTree'
import FileTabs from './FileTabs'
import FileViewer from './FileViewer'

// Largura mínima/máxima do painel de árvore (em pixels)
const TREE_MIN_WIDTH = 180
const TREE_MAX_WIDTH = 400
const TREE_DEFAULT_WIDTH = 240

/**
 * CodeViewInner — layout orquestrador (requer CodeProvider acima).
 *
 * Layout:
 * ┌──────────────┬───────────────────────────┐
 * │ FileTree     │ FileTabs                  │
 * │ (lateral)    ├───────────────────────────┤
 * │              │ FileViewer                │
 * └──────────────┴───────────────────────────┘
 *
 * O divisor entre árvore e conteúdo é redimensionável via drag.
 */
function CodeViewInner() {
  const { activeProject } = useProject()
  const [treeWidth, setTreeWidth] = useState(TREE_DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  // Connect backend file change events to debounced tab updates
  useFileWatcher()

  // --- Drag para redimensionar a árvore ---
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = Math.max(TREE_MIN_WIDTH, Math.min(TREE_MAX_WIDTH, e.clientX - rect.left))
      setTreeWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden select-none" style={{ cursor: isDragging ? 'col-resize' : undefined }}>
      {/* Painel esquerdo: Árvore de arquivos */}
      <div
        className="h-full border-r border-gray-200 dark:border-border-200 bg-gray-50 dark:bg-bg-100 overflow-hidden shrink-0"
        style={{ width: treeWidth }}
      >
        <div className="px-3 py-2 border-b border-gray-200 dark:border-border-200">
          <span className="text-xs font-medium text-gray-400 dark:text-text-300 uppercase tracking-wide">
            Arquivos
          </span>
        </div>
        <FileTree />
      </div>

      {/* Divisor redimensionável */}
      <div
        className="w-1 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors shrink-0"
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none' }}
      />

      {/* Painel direito: Tabs + Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <FileTabs />
        <div className="flex-1 overflow-hidden">
          <FileViewer />
        </div>
      </div>
    </div>
  )
}

/**
 * CodeView — wrapper com CodeProvider.
 * Cada instância de CodeView tem seu próprio contexto de código.
 */
export default function CodeView() {
  return (
    <CodeProvider>
      <CodeViewInner />
    </CodeProvider>
  )
}
