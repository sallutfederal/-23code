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
 * Cada tab mostra: ícone + nome do arquivo + indicador de modificação + botão fechar.
 * Scroll horizontal automático quando há mais tabs do que cabe na largura.
 */
export default function FileTabs() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, reloadFile } = useCode()

  if (openTabs.length === 0) return null

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-border-200 bg-gray-50 dark:bg-bg-100 overflow-x-auto">
      {openTabs.map(tab => {
        const isActive = tab.path === activeTabPath
        const ext = tab.name.includes('.') ? '.' + tab.name.split('.').pop() : ''
        const iconColor = TAB_ICON_COLORS[ext] || '#888888'

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

            {/* Nome (sem path) */}
            <span className="truncate max-w-[120px]">{tab.name}</span>

            {/* Indicador de modificação externa */}
            {tab.modified && (
              <button
                onClick={(e) => { e.stopPropagation(); reloadFile(tab.path) }}
                className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0 hover:scale-150 transition-transform"
                title="Arquivo modificado externamente — clique para recarregar"
              />
            )}

            {/* Botão fechar */}
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
              className="ml-0.5 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-bg-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Fechar tab"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
