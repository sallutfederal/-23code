import { useState, useEffect, useRef } from 'react'

/**
 * Mapeia nome da tool para label legível + ícone
 */
const TOOL_META = {
  read_file: { label: 'Lendo', color: 'text-blue-400', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  create_file: { label: 'Criando', color: 'text-emerald-400', icon: 'M12 4v16m8-8H4' },
  edit_file: { label: 'Editando', color: 'text-violet-400', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  create_folder: { label: 'Criando pasta', color: 'text-blue-400', icon: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  run_command: { label: 'Executando', color: 'text-amber-400', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
}

function getToolMeta(toolName) {
  return TOOL_META[toolName] || { label: toolName, color: 'text-gray-400', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
}

/**
 * Trunca path para exibição legível
 */
function truncatePath(target, maxLen = 50) {
  if (!target) return ''
  if (target.length <= maxLen) return target
  // Pegar últimos segmentos significativos
  const parts = target.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return target.slice(-maxLen)
  return '...' + parts.slice(-2).join('/')
}

/**
 * ActivityTrace — exibe ações de tools em tempo real.
 * 
 * Props:
 * - actions: Array de { id, tool, target, error?, timestamp }
 * - phase: 'idle' | 'exploring' | 'thinking' | 'responding'
 * - totalActions: número total de ações
 * - isExpanded: se o trace está expandido
 * - onToggleExpand: função para expandir/colapsar
 */
function ActivityTrace({ actions, phase, totalActions, isExpanded, onToggleExpand }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const containerRef = useRef(null)

  // Animar entrada de cada linha nova
  useEffect(() => {
    if (actions.length > visibleCount) {
      // Adicionar com delay para animação
      const timer = setTimeout(() => {
        setVisibleCount(actions.length)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [actions.length, visibleCount])

  // Resetar count quando actions zera (nova mensagem)
  useEffect(() => {
    if (actions.length === 0) {
      setVisibleCount(0)
    }
  }, [actions.length])

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current && isExpanded) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [visibleCount, isExpanded])

  // Não renderizar se não houver ações e estiver idle
  if (phase === 'idle' && actions.length === 0) return null

  const phaseConfig = {
    exploring: { label: 'Explorando', dotColor: 'bg-blue-400' },
    thinking: { label: 'Pensando', dotColor: 'bg-amber-400' },
    responding: { label: 'Respondendo', dotColor: 'bg-emerald-400' },
    idle: { label: 'Concluído', dotColor: 'bg-gray-400' },
  }

  const currentPhase = phaseConfig[phase] || phaseConfig.idle
  const showTrace = isExpanded && actions.length > 0

  return (
    <div className="mb-3">
      {/* Cabeçalho colapsável */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100/80 dark:bg-bg-200/80 hover:bg-gray-200/80 dark:hover:bg-bg-300/80 transition-colors w-full text-left group"
      >
        {/* Indicador de fase */}
        <span className={`w-2 h-2 rounded-full ${currentPhase.dotColor} ${
          phase !== 'idle' && phase !== 'responding' ? 'animate-pulse' : ''
        }`} />
        
        <span className="text-xs font-medium text-gray-600 dark:text-text-200">
          {currentPhase.label}
        </span>

        {totalActions > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-text-300 font-mono">
            {totalActions} {totalActions === 1 ? 'ação' : 'ações'}
          </span>
        )}

        {/* Seta de expandir/colapsar */}
        <svg
          className={`w-3 h-3 text-gray-400 dark:text-text-300 ml-auto transition-transform duration-200 ${
            showTrace ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lista de ações (colapsável) */}
      {showTrace && (
        <div
          ref={containerRef}
          className="mt-1 ml-2 pl-3 border-l border-gray-200 dark:border-border-300 space-y-0.5 max-h-48 overflow-y-auto"
        >
          {actions.slice(0, visibleCount).map((action, i) => {
            const meta = getToolMeta(action.tool)
            return (
              <div
                key={action.id}
                className="flex items-center gap-2 py-0.5 animate-fadeIn"
                style={{
                  animation: 'fadeIn 0.2s ease-out forwards',
                  opacity: 0,
                  animationDelay: `${Math.min(i * 30, 200)}ms`
                }}
              >
                {/* Ícone da tool */}
                <svg
                  className={`w-3 h-3 flex-shrink-0 ${action.error ? 'text-red-400' : meta.color}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                </svg>

                {/* Label da tool */}
                <span className={`text-[11px] font-medium flex-shrink-0 ${
                  action.error ? 'text-red-400' : 'text-gray-500 dark:text-text-300'
                }`}>
                  {action.error ? 'Erro' : meta.label}
                </span>

                {/* Alvo truncado */}
                <span className="text-[10px] font-mono text-gray-400 dark:text-text-300/70 truncate" title={action.target}>
                  {truncatePath(action.target)}
                </span>

                {/* Indicador de erro */}
                {action.error && (
                  <span className="text-[9px] text-red-400 truncate ml-auto" title={action.error}>
                    {action.error}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CSS para animação */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default ActivityTrace
