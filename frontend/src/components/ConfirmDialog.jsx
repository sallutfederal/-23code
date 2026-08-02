import { useEffect, useState, useRef } from 'react'

const ACTION_CONFIG = {
  CREATE_DIR: { verb: 'Permissão necessária', subtitle: 'Criar pasta', color: 'blue', iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  CREATE_FILE: { verb: 'Permissão necessária', subtitle: 'Criar arquivo', color: 'emerald', iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  EDIT_FILE: { verb: 'Permissão necessária', subtitle: 'Editar arquivo', color: 'violet', iconPath: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
  DELETE_FILE: { verb: 'Permissão necessária', subtitle: 'Deletar arquivo', color: 'red', iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  DELETE_DIR: { verb: 'Permissão necessária', subtitle: 'Deletar pasta', color: 'red', iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  READ_FILE: { verb: 'Permissão necessária', subtitle: 'Acessar arquivo', color: 'amber', iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  RUN_COMMAND: { verb: 'Permissão necessária', subtitle: 'Executar comando', color: 'amber', iconPath: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
}

const COLOR_MAP = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', ring: 'ring-blue-500/20', btn: 'bg-blue-500 hover:bg-blue-600' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', ring: 'ring-violet-500/20', btn: 'bg-violet-500 hover:bg-violet-600' },
  red: { bg: 'bg-red-500/10', text: 'text-red-500', ring: 'ring-red-500/20', btn: 'bg-red-500 hover:bg-red-600' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', ring: 'ring-amber-500/20', btn: 'bg-amber-500 hover:bg-amber-600' },
}

function ConfirmDialog({ requestId, action, filePath, preview, scope, onConfirm, onDeny, onAlwaysAllow, timeout = 300000 }) {
  const [timeLeft, setTimeLeft] = useState(timeout)
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef(null)
  const config = ACTION_CONFIG[action] || { verb: 'Permissão necessária', subtitle: 'Operação', color: 'amber', iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }
  const colors = COLOR_MAP[config.color]

  useEffect(() => {
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, timeout - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        setIsExiting(true)
        setTimeout(onDeny, 200)
      }
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [timeout, onDeny])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsExiting(true)
        setTimeout(onDeny, 200)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDeny])

  const handleConfirm = () => {
    setIsExiting(true)
    setTimeout(() => onConfirm(), 200)
  }

  const handleAlwaysAllow = () => {
    setIsExiting(true)
    setTimeout(() => onAlwaysAllow?.(scope || filePath), 200)
  }

  const handleDeny = () => {
    setIsExiting(true)
    setTimeout(onDeny, 200)
  }

  const formatTime = (ms) => {
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = (timeLeft / timeout) * 100
  const progressColor = progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-amber-500' : 'bg-red-500'

  const renderPreview = () => {
    if (!preview) return null

    if (preview.type === 'content') {
      const content = preview.content || ''
      if (!content.trim()) {
        return (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-border-300 p-6 text-center">
            <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-text-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="mt-2 text-sm text-text-300">Arquivo vazio</p>
          </div>
        )
      }
      return (
        <div className="rounded-xl bg-gray-50 dark:bg-bg-200 border border-gray-100 dark:border-border-300 overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-bg-300 border-b border-gray-200 dark:border-border-300 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <span className="text-[10px] text-text-300 font-mono">preview</span>
          </div>
          <pre className="p-3 text-xs font-mono text-text-100 whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
            {content.slice(0, 800)}{content.length > 800 && <span className="text-text-300">...</span>}
          </pre>
        </div>
      )
    }

    if (preview.type === 'diff') {
      const { diff } = preview

      if (diff.truncated) {
        return (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Arquivo muito grande para preview</p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{diff.message}</p>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="rounded-xl bg-gray-50 dark:bg-bg-200 border border-gray-100 dark:border-border-300 overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-bg-300 border-b border-gray-200 dark:border-border-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <span className="text-[10px] text-text-300 font-mono">diff</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> removido</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> adicionado</span>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto font-mono text-xs">
            {diff.lines.map((line, i) => {
              if (line.type === 'separator') {
                return (
                  <div key={i} className="px-4 py-1 text-text-300 text-center border-y border-gray-200 dark:border-border-300 bg-gray-100/50 dark:bg-bg-300/50">
                    ···
                  </div>
                )
              }
              if (line.type === 'removed') {
                return (
                  <div key={i} className="px-4 py-0.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-l-2 border-red-400">
                    <span className="inline-block w-8 text-right text-text-300 mr-3 select-none opacity-50">{line.lineOld || ''}</span>
                    − {line.content}
                  </div>
                )
              }
              if (line.type === 'added') {
                return (
                  <div key={i} className="px-4 py-0.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-l-2 border-green-400">
                    <span className="inline-block w-8 text-right text-text-300 mr-3 select-none opacity-50">{line.lineNew || ''}</span>
                    + {line.content}
                  </div>
                )
              }
              return (
                <div key={i} className="px-4 py-0.5 text-text-200">
                  <span className="inline-block w-8 text-right text-text-300 mr-3 select-none opacity-50">{line.lineOld || ''}</span>
                  {line.content}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return null
  }

  const fileName = filePath?.split(/[/\\]/).pop() || filePath
  const fileDir = filePath?.replace(fileName, '') || ''
  const displayScope = scope || filePath

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 transition-all duration-200 ${isExiting ? 'bg-black/0' : 'bg-black/60 backdrop-blur-sm'}`}>
      <div className={`relative w-full max-w-md bg-white dark:bg-bg-100 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-bg-300">
          <div className={`h-full ${progressColor} transition-all duration-1000 ease-linear`} style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-2xl ${colors.bg} ring-1 ${colors.ring} flex items-center justify-center`}>
              <svg className={`w-6 h-6 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={config.iconPath} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-text-000">
                {config.verb}
              </h2>
              <p className="text-sm text-gray-500 dark:text-text-300">
                {config.subtitle}
              </p>
              {/* Path/escopo em bloco monoespaçado */}
              {displayScope && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-bg-200 border border-gray-200 dark:border-border-300">
                  <code className="text-xs font-mono text-gray-700 dark:text-text-200 break-all">
                    {displayScope}
                  </code>
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono ${
                timeLeft > 60000 ? 'bg-gray-100 dark:bg-bg-200 text-text-300' :
                timeLeft > 10000 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="px-6 pb-4">
            {renderPreview()}
          </div>
        )}

        {/* Actions — 3 botões */}
        <div className="px-6 py-4 bg-gray-50/80 dark:bg-bg-000/80 backdrop-blur-sm border-t border-gray-100 dark:border-border-300">
          <div className="flex items-center gap-2">
            {/* Negar — sempre visível */}
            <button
              onClick={handleDeny}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-text-200 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 border border-gray-200 dark:border-border-300 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Negar
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Permitir sempre */}
            <button
              onClick={handleAlwaysAllow}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-text-100 rounded-xl border border-gray-300 dark:border-border-200 hover:bg-gray-100 dark:hover:bg-bg-200 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Permitir sempre
            </button>

            {/* Permitir uma vez — ação principal */}
            <button
              onClick={handleConfirm}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white ${colors.btn} rounded-xl shadow-lg shadow-${config.color}-500/25 transition-all duration-150 active:scale-95`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Permitir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
