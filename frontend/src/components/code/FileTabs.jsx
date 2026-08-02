import { useState, useCallback } from 'react'
import { useCode } from '../../context/CodeContext'

/**
 * Mapeamento de extensões para cores dos ícones nas tabs.
 */
const TAB_ICON_COLORS = {
  '.js': '#f7df1e', '.jsx': '#61dafb', '.mjs': '#f7df1e', '.cjs': '#f7df1e',
  '.ts': '#3178c6', '.tsx': '#3178c6',
  '.css': '#264de4', '.scss': '#cd6799',
  '.html': '#e34c26', '.json': '#000000',
  '.py': '#3776ab', '.go': '#00add8', '.rs': '#dea584',
  '.md': '#083fa1', '.env': '#ecd53f',
}

/**
 * FileTabs — barra horizontal de tabs de arquivos abertos.
 *
 * Cada tab mostra:
 * - Ícone por extensão
 * - Nome do arquivo
 * - Indicador de dirty (asterisco) quando há alterações não salvas
 * - Indicador de modificação externa (bolinha amarela)
 * - Botão fechar
 *
 * Se tentar fechar tab com dirty, abre confirmação inline.
 */
export default function FileTabs() {
  const { openTabs, activeTabPath, setActiveTab, requestCloseTab, performCloseTab } = useCode()
  const [confirmClosePath, setConfirmClosePath] = useState(null)

  const handleClose = useCallback((e, tabPath) => {
    e.stopPropagation()
    const needsConfirm = requestCloseTab(tabPath)
    if (needsConfirm) {
      setConfirmClosePath(tabPath)
    }
  }, [requestCloseTab])

  const handleConfirmClose = useCallback((confirm) => {
    if (confirm && confirmClosePath) {
      performCloseTab(confirmClosePath)
    }
    setConfirmClosePath(null)
  }, [confirmClosePath, performCloseTab])

  if (openTabs.length === 0) return null

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-border-200 bg-gray-50 dark:bg-bg-100 overflow-x-auto">
      {openTabs.map(tab => {
        const isActive = tab.path === activeTabPath
        const ext = tab.name.includes('.') ? '.' + tab.name.split('.').pop() : ''
        const iconColor = TAB_ICON_COLORS[ext] || '#888888'
        const isConfirming = confirmClosePath === tab.path

        return (
          <div
            key={tab.path}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-r border-gray-200 dark:border-border-200 cursor-pointer select-none shrink-0 group transition-colors ${
              isActive
                ? 'bg-white dark:bg-bg-000 text-gray-900 dark:text-text-000'
                : 'text-gray-500 dark:text-text-300 hover:bg-gray-100 dark:hover:bg-bg-200'
            }`}
            onClick={() => setActiveTab(tab.path)}
          >
            {/* Ícone */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: iconColor }} className="shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>

            {/* Nome */}
            <span className="truncate max-w-[120px]">{tab.name}</span>

            {/* Indicador de dirty (asterisco) */}
            {tab.dirty && (
              <span className="text-amber-500 dark:text-amber-400 font-bold text-xs leading-none">*</span>
            )}

            {/* Indicador de modificação externa (bolinha) */}
            {tab.modified && !tab.dirty && (
              <button
                onClick={(e) => { e.stopPropagation() }}
                className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 shrink-0"
                title="Modificado pelo agente"
              />
            )}

            {/* Indicador de conflito */}
            {tab.conflict && (
              <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500 shrink-0" title="Conflito de edição"/>
            )}

            {/* Botão fechar ou confirmação */}
            {isConfirming ? (
              <div className="flex items-center gap-0.5 ml-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleConfirmClose(true) }}
                  className="p-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Fechar e descartar alterações"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleConfirmClose(false) }}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-bg-300 transition-colors"
                  title="Cancelar"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => handleClose(e, tab.path)}
                className="ml-0.5 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-bg-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Fechar tab"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
