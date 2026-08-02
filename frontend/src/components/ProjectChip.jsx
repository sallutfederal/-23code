/**
 * ProjectChip — Chip clicável que mostra o projeto ativo.
 * 
 * Props:
 * - project: { id, name, path } ou null
 * - onClick: função chamada ao clicar (abre modal)
 * 
 * Não gerencia estado interno — recebe tudo via props.
 */
function ProjectChip({ project, onClick }) {
  // Gera uma cor baseada no hash do nome do projeto
  const getProjectColor = (name) => {
    const colors = [
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    ]
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Pega apenas o nome da pasta (último segmento do path)
  const getFolderName = (p) => {
    if (!p?.path) return p?.name || 'Projeto'
    const parts = p.path.replace(/[/\\]$/, '').split(/[/\\]/)
    return parts[parts.length - 1] || p.name || 'Projeto'
  }

  if (!project) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                   border border-dashed border-gray-300 dark:border-border-300
                   text-gray-400 dark:text-text-300
                   hover:border-gray-400 dark:hover:border-border-200
                   hover:text-gray-500 dark:hover:text-text-200
                   hover:bg-gray-50 dark:hover:bg-bg-200
                   transition-all duration-150 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <span>Selecionar projeto</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    )
  }

  const colorClass = getProjectColor(project.name || project.path)
  const folderName = getFolderName(project)

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-all duration-150 cursor-pointer
                  hover:shadow-sm active:scale-[0.98] ${colorClass}`}
      title={project.path}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
      <span className="max-w-[120px] truncate">{folderName}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  )
}

export default ProjectChip
