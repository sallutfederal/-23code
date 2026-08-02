import { Suspense, lazy } from 'react'
import { useCode } from '../../context/CodeContext'
import { useUser } from '../../context/UserContext'
import ConflictDialog from './ConflictDialog'

// Monaco Editor — lazy load (só carrega quando a primeira tab é aberta)
// ~5MB, não deve bloquear o boot inicial do app
const MonacoEditor = lazy(() => import('./MonacoEditor'))

// Syntax Highlighter — fallback read-only para arquivos grandes ou sensíveis
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

/**
 * FileViewer — exibe o conteúdo do arquivo selecionado.
 *
 * Decide entre:
 * - Monaco Editor: para arquivos editáveis (< 3MB, não sensíveis)
 * - SyntaxHighlighter: para arquivos grandes, sensíveis, ou durante loading
 *
 * Também renderiza ConflictDialog quando há conflito usuário vs agente.
 */
export default function FileViewer() {
  const { activeTab, reloadFile } = useCode()
  const { theme } = useUser()
  const isDark = theme === 'dark'

  // Nenhuma tab selecionada
  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-bg-200 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-text-300">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-text-200 mb-1">Nenhum arquivo aberto</p>
        <p className="text-xs text-gray-400 dark:text-text-300">
          Selecione um arquivo na árvore para visualizar
        </p>
      </div>
    )
  }

  // Loading
  if (activeTab.loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="thinking-dots">
          <div className="thinking-dot" style={{ animationDelay: '0s' }}/>
          <div className="thinking-dot" style={{ animationDelay: '0.2s' }}/>
          <div className="thinking-dot" style={{ animationDelay: '0.4s' }}/>
        </div>
        <p className="text-xs text-gray-400 dark:text-text-300 mt-2">Carregando conteúdo...</p>
      </div>
    )
  }

  // Erro
  if (activeTab.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 dark:text-red-400">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mb-1">Erro ao ler arquivo</p>
        <p className="text-xs text-gray-500 dark:text-text-300">{activeTab.error}</p>
      </div>
    )
  }

  // Arquivo sensível
  if (activeTab.sensitive) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 dark:text-amber-400">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">Arquivo protegido</p>
        <p className="text-xs text-gray-500 dark:text-text-300">
          Este arquivo contém dados sensíveis e não pode ser exibido
        </p>
      </div>
    )
  }

  // Arquivo muito grande — read-only com SyntaxHighlighter
  if (activeTab.tooLarge) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 dark:text-amber-400 shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Arquivo grande demais para edição — visualização read-only
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            language={activeTab.language || 'plaintext'}
            style={isDark ? oneDark : oneLight}
            showLineNumbers
            lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: isDark ? '#555' : '#ccc', fontSize: '12px' }}
            customStyle={{ margin: 0, padding: '12px 0', background: 'transparent', fontSize: '13px', lineHeight: '1.5' }}
            wrapLongLines
          >
            {activeTab.content || ''}
          </SyntaxHighlighter>
        </div>
      </div>
    )
  }

  // Renderizar Monaco Editor (arquivo editável)
  return (
    <div className="h-full flex flex-col">
      {/* Banner de modificação externa (sem dirty) */}
      {activeTab.modified && !activeTab.dirty && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 dark:text-blue-400 shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-blue-700 dark:text-blue-300">
            Arquivo atualizado pelo agente
          </span>
          <button
            onClick={() => reloadFile(activeTab.path)}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Recarregar
          </button>
        </div>
      )}

      {/* Monaco Editor com lazy loading */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="thinking-dots">
                <div className="thinking-dot" style={{ animationDelay: '0s' }}/>
                <div className="thinking-dot" style={{ animationDelay: '0.2s' }}/>
                <div className="thinking-dot" style={{ animationDelay: '0.4s' }}/>
              </div>
              <span className="text-xs text-gray-400 dark:text-text-300 ml-2">Carregando editor...</span>
            </div>
          }
        >
          <MonacoEditor tab={activeTab} />
        </Suspense>
      </div>

      {/* Modal de conflito (agente editou enquanto havia dirty) */}
      <ConflictDialog tab={activeTab} />
    </div>
  )
}
