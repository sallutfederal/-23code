import { memo } from 'react'
import { useCode } from '../../context/CodeContext'

/**
 * Mapeamento de extensões para cores de ícone.
 * Cada categoria visual ajuda o usuário a identificar tipo de arquivo rapidamente.
 */
const EXT_COLORS = {
  // JS/TS — tons de amarelo/azul
  '.js': '#f7df1e', '.jsx': '#61dafb', '.mjs': '#f7df1e', '.cjs': '#f7df1e',
  '.ts': '#3178c6', '.tsx': '#3178c6',
  // Estilo
  '.css': '#264de4', '.scss': '#cd6799', '.less': '#1d365d',
  // Markup
  '.html': '#e34c26', '.htm': '#e34c26', '.svg': '#ffb13b',
  // Dados
  '.json': '#000000', '.yaml': '#cb171e', '.yml': '#cb171e', '.toml': '#9c4221',
  // Backend
  '.py': '#3776ab', '.rb': '#cc342d', '.go': '#00add8', '.rs': '#dea584',
  '.java': '#ed8b00', '.kt': '#7f52ff', '.swift': '#f05138',
  // Shell/DevOps
  '.sh': '#4eaa25', '.bash': '#4eaa25', '.sql': '#e38c00',
  // Docs
  '.md': '#083fa1', '.mdx': '#083fa1',
  // Outros
  '.env': '#ecd53f', '.lock': '#888888',
}

/**
 * Ícones SVG inline para cada tipo de elemento.
 * Pastas têm ícone diferente de arquivos, e arquivos sensíveis mostram cadeado.
 */
function FolderIcon({ expanded }) {
  if (expanded) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 dark:text-blue-400 shrink-0">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        <polyline points="6 14 2 14 2 10" opacity="0.5"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-text-300 shrink-0">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function FileIcon({ extension, sensitive }) {
  if (sensitive) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 dark:text-amber-400 shrink-0">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    )
  }

  const color = EXT_COLORS[extension] || '#888888'
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" style={{ color }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

/**
 * FileTreeNode — nó recursivo da árvore de arquivos.
 *
 * Se `isDir`: renderiza pasta expansível com filhos recursivos.
 * Se `isFile`: renderiza arquivo clicável que abre tab.
 *
 * A indentação é controlada por `depth` (nível hierárquico).
 */
function FileTreeNode({ node, depth = 0 }) {
  const { expandedDirs, toggleDir, openFile, activeTabPath } = useCode()
  const isExpanded = expandedDirs.has(node.path)
  const isActive = node.path === activeTabPath

  if (node.isDir) {
    // Ordenar filhos: pastas primeiro, depois arquivos, alfabético
    const sortedChildren = [...(node.children || [])].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.name.localeCompare(b.name)
    })

    return (
      <div>
        <button
          onClick={() => toggleDir(node.path)}
          className="flex items-center gap-1.5 w-full px-2 py-0.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-bg-200 rounded transition-colors group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <FolderIcon expanded={isExpanded} />
          <span className="truncate text-gray-700 dark:text-text-100">{node.name}</span>
          {sortedChildren.length > 0 && (
            <span className="ml-auto text-[10px] text-gray-400 dark:text-text-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {sortedChildren.length}
            </span>
          )}
        </button>
        {isExpanded && (
          <div>
            {sortedChildren.map(child => (
              <FileTreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Arquivo
  return (
    <button
      onClick={() => openFile(node.path, node.name, node.sensitive, node.language, node.tooLarge)}
      className={`flex items-center gap-1.5 w-full px-2 py-0.5 text-left text-sm rounded transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          : 'hover:bg-gray-100 dark:hover:bg-bg-200 text-gray-600 dark:text-text-200'
      } ${node.sensitive ? 'opacity-60' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      title={node.sensitive ? 'Arquivo protegido — conteúdo não disponível' : node.name}
    >
      <FileIcon extension={node.extension} sensitive={node.sensitive} />
      <span className="truncate">{node.name}</span>
      {node.sensitive && (
        <span className="ml-auto text-[10px] text-amber-500 dark:text-amber-400 shrink-0">protegido</span>
      )}
    </button>
  )
}

export default memo(FileTreeNode)
