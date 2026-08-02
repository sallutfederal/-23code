import { useCode } from '../../context/CodeContext'

// Syntax highlighting — lazy load para não pesar o bundle
// O import estático é ok aqui porque react-syntax-highlighter já está nas deps
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useUser } from '../../context/UserContext'

/**
 * FileViewer — exibe o conteúdo do arquivo selecionado.
 *
 * Estados:
 * - Nenhuma tab ativa: tela de boas-vindas
 * - Tab com loading: spinner
 * - Tab com erro: mensagem de erro
 * - Tab sensível: mensagem de bloqueio
 * - Tab com conteúdo: syntax highlighting via react-syntax-highlighter
 * - Tab modificada: banner + conteúdo antigo (stale)
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

  // Contúdo
  const content = activeTab.content || ''
  const language = activeTab.language || 'text'

  return (
    <div className="h-full flex flex-col">
      {/* Banner de modificação externa */}
      {activeTab.modified && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 dark:text-amber-400 shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Arquivo modificado externamente
          </span>
          <button
            onClick={() => reloadFile(activeTab.path)}
            className="ml-auto text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            Recarregar
          </button>
        </div>
      )}

      {/* Código com syntax highlighting */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={isDark ? oneDark : oneLight}
          showLineNumbers
          lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: isDark ? '#555' : '#ccc', fontSize: '12px' }}
          customStyle={{
            margin: 0,
            padding: '12px 0',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
          wrapLongLines
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
