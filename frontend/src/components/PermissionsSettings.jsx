import { useState, useEffect } from 'react'

const ACTION_LABELS = {
  CREATE_DIR: 'Criar pasta',
  CREATE_FILE: 'Criar arquivo',
  EDIT_FILE: 'Editar arquivo',
  READ_FILE: 'Acessar arquivo',
  RUN_COMMAND: 'Executar comando',
}

const ACTION_COLORS = {
  CREATE_DIR: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  CREATE_FILE: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  EDIT_FILE: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  READ_FILE: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  RUN_COMMAND: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
}

function PermissionsSettings({ projectId }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRules()
  }, [projectId])

  const loadRules = async () => {
    if (!window.electronAPI?.listPermissionRules) return
    setLoading(true)
    try {
      const result = await window.electronAPI.listPermissionRules(projectId)
      if (result.success) {
        setRules(result.data)
      }
    } catch (err) {
      console.error('Erro ao carregar regras:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (ruleId) => {
    if (!window.electronAPI?.removePermissionRule) return
    try {
      const result = await window.electronAPI.removePermissionRule(ruleId)
      if (result.success) {
        setRules(prev => prev.filter(r => r.id !== ruleId))
      }
    } catch (err) {
      console.error('Erro ao remover regra:', err)
    }
  }

  const handleClearAll = async () => {
    if (!window.electronAPI?.clearPermissionRules) return
    if (!confirm('Remover todas as regras de permissão deste projeto?')) return
    try {
      const result = await window.electronAPI.clearPermissionRules(projectId)
      if (result.success) {
        setRules([])
      }
    } catch (err) {
      console.error('Erro ao limpar regras:', err)
    }
  }

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-text-000">Regras de "Permitir sempre"</h3>
          <p className="text-xs text-gray-500 dark:text-text-300 mt-0.5">
            Permissões salvas que pulam o modal de confirmação automaticamente
          </p>
        </div>
        {rules.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-text-300">
          Carregando...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-border-300">
          <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-text-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-text-300">
            Nenhuma regra salva
          </p>
          <p className="text-xs text-gray-400 dark:text-text-300 mt-1">
            Use "Permitir sempre" no modal de confirmação para criar regras
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-bg-200 border border-gray-100 dark:border-border-300"
            >
              {/* Badge do tipo de ação */}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[rule.action] || 'bg-gray-100 text-gray-600'}`}>
                {ACTION_LABELS[rule.action] || rule.action}
              </span>

              {/* Escopo */}
              <div className="flex-1 min-w-0">
                <code className="text-[11px] font-mono text-gray-600 dark:text-text-200 break-all">
                  {rule.scope}
                </code>
              </div>

              {/* Data */}
              <span className="text-[10px] text-gray-400 dark:text-text-300 flex-shrink-0">
                {formatDate(rule.createdAt)}
              </span>

              {/* Botão remover */}
              <button
                onClick={() => handleRemove(rule.id)}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="Revogar permissão"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PermissionsSettings
