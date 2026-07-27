import { useEffect } from 'react'

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-bg-000 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          <h2 className="text-lg font-semibold text-text-000">{title}</h2>
          <p className="mt-1 text-sm text-text-200">{message}</p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              className="group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-lg h-10 px-4 text-sm font-medium text-text-000 transition-colors"
            >
              <span className="absolute inset-0 rounded-[inherit] bg-fill-secondary group-hover:bg-fill-secondary-hover transition-colors" />
              <span className="relative">Cancelar</span>
            </button>
            <button
              onClick={onConfirm}
              className="group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-lg h-10 px-4 text-sm font-medium text-white transition-colors"
            >
              <span className="absolute inset-0 rounded-[inherit] bg-danger group-hover:bg-danger-hover transition-colors" />
              <span className="relative">Apagar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
