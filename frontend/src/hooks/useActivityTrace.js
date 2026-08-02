import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook que gerencia o Activity Trace — exibe ações de tools em tempo real.
 * 
 * Escuta eventos IPC do backend:
 * - agent:tool:start: cada tool chamada (tipo, nome, alvo, timestamp)
 * - agent:phase_change: mudança de fase (exploring → thinking → responding)
 * 
 * Retorna:
 * - actions: array de ações executadas
 * - phase: fase atual ('idle' | 'exploring' | 'thinking' | 'responding')
 * - totalActions: total de ações nesta rodada
 * - isExpanded: se o trace está expandido
 * - toggleExpand: função para expandir/colapsar
 * - reset: limpar trace (chamar ao iniciar nova mensagem)
 */
export function useActivityTrace() {
  const [actions, setActions] = useState([])
  const [phase, setPhase] = useState('idle')
  const [totalActions, setTotalActions] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)
  const phaseRef = useRef('idle')

  useEffect(() => {
    if (!window.electronAPI?.onToolStart) return

    const handleToolStart = (data) => {
      if (data.type === 'tool_error') {
        // Erro: adicionar ação com erro
        setActions(prev => [...prev, {
          id: `${data.timestamp}-${data.tool}`,
          tool: data.tool,
          target: data.target,
          error: data.error,
          timestamp: data.timestamp
        }])
      } else {
        // Sucesso: adicionar ação
        setActions(prev => [...prev, {
          id: `${data.timestamp}-${data.tool}`,
          tool: data.tool,
          target: data.target,
          timestamp: data.timestamp
        }])
      }
      setTotalActions(data.totalActions || 0)
    }

    const handlePhaseChange = (data) => {
      phaseRef.current = data.phase
      setPhase(data.phase)
      setTotalActions(data.totalActions || 0)
      
      // Auto-colapsar quando a resposta final chegar
      if (data.phase === 'responding') {
        setTimeout(() => setIsExpanded(false), 500)
      }
    }

    window.electronAPI.onToolStart(handleToolStart)
    window.electronAPI.onPhaseChange(handlePhaseChange)

    return () => {
      window.electronAPI.removeToolStartListener()
      window.electronAPI.removePhaseChangeListener()
    }
  }, [])

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const reset = useCallback(() => {
    setActions([])
    setPhase('idle')
    setTotalActions(0)
    setIsExpanded(true)
    phaseRef.current = 'idle'
  }, [])

  return {
    actions,
    phase,
    totalActions,
    isExpanded,
    toggleExpand,
    reset
  }
}
