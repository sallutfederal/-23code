import { useCode } from '../../context/CodeContext'
import { useProject } from '../../context/ProjectContext'
import FileTreeNode from './FileTreeNode'

/**
 * FileTree — painel lateral mostrando a árvore de pastas/arquivos do projeto.
 *
 * Popula seus dados do CodeContext (que por sua vez usa o repoMap do ProjectContext).
 * Mostra estado vazio quando nenhum projeto está vinculado.
 */
export default function FileTree() {
  const { treeData } = useCode()
  const { activeProject } = useProject()

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-bg-200 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-text-300">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-text-200">Nenhum projeto vinculado</p>
        <p className="text-xs text-gray-400 dark:text-text-300 mt-1">
          Vincule um projeto na aba Início para ver os arquivos
        </p>
      </div>
    )
  }

  if (!treeData) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-bg-200 flex items-center justify-center mb-3">
          <div className="thinking-dots">
            <div className="thinking-dot" style={{ animationDelay: '0s' }}/>
            <div className="thinking-dot" style={{ animationDelay: '0.2s' }}/>
            <div className="thinking-dot" style={{ animationDelay: '0.4s' }}/>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-text-200">Carregando estrutura...</p>
      </div>
    )
  }

  const topLevel = treeData.children || []

  return (
    <div className="h-full overflow-y-auto py-1">
      {topLevel.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-text-200">Projeto vazio</p>
        </div>
      ) : (
        topLevel.map(node => (
          <FileTreeNode key={node.path} node={node} depth={0} />
        ))
      )}
    </div>
  )
}
