import { useState, useEffect, useRef } from 'react'

/**
 * ProjectModal — Modal de seleção e adição de projetos.
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - projects: array de projetos salvos
 * - activeProject: projeto atualmente ativo
 * - onSelect: (project) => void
 * - onAdd: () => void (abre dialog nativo)
 * - loading: boolean (durante escaneamento)
 * 
 * Funcionalidades:
 * - Lista projetos com busca/filtro
 * - Botão fixo "+ Adicionar projeto"
 * - Fecha com Esc ou clique fora
 * - Indicador visual de projeto ativo
 */
function ProjectModal({ isOpen, onClose, projects, activeProject, onSelect, onAdd, loading }) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Filtra projetos pela busca
  const filteredProjects = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.path || '').toLowerCase().includes(search.toLowerCase())
  )

  // Foca no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredProjects.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filteredProjects[selectedIndex]) {
        e.preventDefault()
        onSelect(filteredProjects[selectedIndex])
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredProjects, selectedIndex, onSelect, onClose])

  // Scroll automático para item selecionado
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Gera cor baseada no hash do nome
  const getProjectColor = (name) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
      'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
    ]
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(/[/\\]/).pop()?.slice(0, 2)?.toUpperCase() || name.slice(0, 2).toUpperCase()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[250] flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-bg-100 rounded-2xl shadow-2xl border border-gray-200 dark:border-border-300 overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-border-300">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-text-000">
              Selecionar Projeto
            </h2>
            <p className="text-xs text-text-300 mt-0.5">
              Escolha um projeto para trabalhar
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors text-text-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-border-300">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-text-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar projetos..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedIndex(0) }}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-bg-200 border border-gray-200 dark:border-border-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-gray-900 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300"
            />
          </div>
        </div>

        {/* Botão adicionar */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-border-300">
          <button
            onClick={() => { onAdd(); onClose() }}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-bg-300 flex items-center justify-center">
              {loading ? (
                <div className="w-4 h-4 border-2 border-gray-300 dark:border-text-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-text-300">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-text-000">
                {loading ? 'Escaneando projeto...' : 'Adicionar projeto'}
              </div>
              <div className="text-xs text-text-300">
                {loading ? 'Lendo estrutura de arquivos' : 'Selecionar uma pasta do computador'}
              </div>
            </div>
          </button>
        </div>

        {/* Lista de projetos */}
        <div ref={listRef} className="max-h-[35vh] overflow-y-auto p-1">
          {filteredProjects.length === 0 ? (
            <div className="py-10 text-center text-gray-400 dark:text-text-300 text-sm">
              {search ? 'Nenhum projeto encontrado' : 'Nenhum projeto cadastrado'}
            </div>
          ) : (
            filteredProjects.map((project, index) => {
              const isActive = activeProject?.id === project.id
              const colorClass = getProjectColor(project.name)
              const initials = getInitials(project.name || project.path)
              const folderName = (project.path || '').replace(/[/\\]$/, '').split(/[/\\]/).pop() || project.name

              return (
                <button
                  key={project.id}
                  onClick={() => { onSelect(project); onClose() }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-gray-50 dark:bg-bg-200'
                      : 'hover:bg-gray-50 dark:hover:bg-bg-200/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-text-000 truncate">
                        {folderName}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent rounded-full">
                          Ativo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-300 truncate mt-0.5" title={project.path}>
                      {project.path}
                    </div>
                  </div>
                  {isActive && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer com dicas de teclado */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-border-300 bg-gray-50/80 dark:bg-bg-000/80 text-[10px] text-text-300">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-bg-200 rounded border border-gray-200 dark:border-border-300">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-bg-200 rounded border border-gray-200 dark:border-border-300">↵</kbd>
              selecionar
            </span>
          </div>
          <span>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

export default ProjectModal
