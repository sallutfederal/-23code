import { useEffect, useCallback, useState, useMemo } from 'react'
import { useCode } from '../../context/CodeContext'
import { computeDiff } from '../../utils/computeDiff'

/**
 * ConflictDialog — modal exibido quando o agente edita um arquivo
 * que o usuário tem alterações não salvas.
 *
 * Opções:
 * - Ver diff: mostra comparação lado a lado
 * - Usar versão do agente: descarta dirty do usuário, salva conteúdo do agente
 * - Manter as minhas: ignora mudança do agente, mantém buffer do usuário
 *
 * NUNCA sobrescreve silenciosamente — o usuário sempre decide.
 */
export default function ConflictDialog({ tab }) {
  const { acceptAgentChanges, rejectAgentChanges } = useCode()
  const [showDiff, setShowDiff] = useState(false)

  // Fechar com Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      rejectAgentChanges(tab.path)
    }
  }, [tab?.path, rejectAgentChanges])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Compute diff between user's buffer and agent's version
  const diff = useMemo(() => {
    if (!tab?.editedContent || !tab?.agentContent) return null
    return computeDiff(tab.editedContent, tab.agentContent)
  }, [tab?.editedContent, tab?.agentContent])

  if (!tab || !tab.conflict) return null

  const fileName = tab.name || tab.path.split(/[/\\]/).pop()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-bg-000 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-in border border-gray-200 dark:border-border-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 dark:text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-text-000">
                Conflito de edição
              </h3>
              <p className="text-sm text-gray-500 dark:text-text-300">
                {fileName}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-text-200">
            O agente modificou este arquivo enquanto você tinha alterações não salvas.
            O que deseja fazer?
          </p>
        </div>

        {/* Diff viewer (collapsible) */}
        {diff && (
          <div className="px-6 pb-2 shrink-0">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-text-300 hover:text-gray-700 dark:hover:text-text-100 transition-colors"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${showDiff ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              {showDiff ? 'Ocultar diff' : 'Ver diff'}
              {diff.truncated && <span className="text-amber-500">(simplificado)</span>}
            </button>

            {showDiff && (
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-border-200 bg-gray-50 dark:bg-bg-100 text-xs font-mono">
                {diff.truncated ? (
                  <div className="p-3 text-gray-500 dark:text-text-300">
                    Arquivo grande ({diff.oldLines} → {diff.newLines} linhas) — diff simplificado.
                    Revise o arquivo após escolher uma versão.
                  </div>
                ) : (
                  <div className="py-1">
                    {diff.lines.map((line, idx) => {
                      if (line.type === 'separator') {
                        return (
                          <div key={idx} className="px-3 py-0.5 text-gray-400 dark:text-text-400 italic">
                            ...
                          </div>
                        )
                      }
                      const isAdded = line.type === 'added'
                      const isRemoved = line.type === 'removed'
                      const bgColor = isAdded
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : isRemoved
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : ''
                      const textColor = isAdded
                        ? 'text-green-700 dark:text-green-300'
                        : isRemoved
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-600 dark:text-text-200'
                      const prefix = isAdded ? '+' : isRemoved ? '-' : ' '
                      const lineNum = isAdded ? line.lineNew : line.lineOld

                      return (
                        <div key={idx} className={`flex px-3 py-0.5 ${bgColor}`}>
                          <span className="w-10 text-right pr-2 text-gray-400 dark:text-text-400 shrink-0 select-none">
                            {lineNum || ''}
                          </span>
                          <span className={`shrink-0 ${textColor}`}>{prefix}</span>
                          <span className={`${textColor} whitespace-pre-wrap break-all`}>{line.content}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="px-6 pb-6 flex flex-col gap-2 shrink-0">
          {/* Usar versão do agente */}
          <button
            onClick={() => acceptAgentChanges(tab.path)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-border-200 hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 dark:text-blue-400">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-text-000">
                Usar versão do agente
              </span>
              <span className="block text-xs text-gray-500 dark:text-text-300">
                Descarta suas alterações e usa a versão salva pelo agente
              </span>
            </div>
          </button>

          {/* Manter as minhas */}
          <button
            onClick={() => rejectAgentChanges(tab.path)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-border-200 hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500 dark:text-violet-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-text-000">
                Manter as minhas alterações
              </span>
              <span className="block text-xs text-gray-500 dark:text-text-300">
                Ignora a mudança do agente e mantém seu buffer de edição
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
