import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'

const MENU_SECTIONS = [
  {
    label: 'Configurações',
    items: [
      { id: 'geral', label: 'Geral', icon: '⚙️' },
      { id: 'conta', label: 'Conta', icon: '👤' },
      { id: 'privacidade', label: 'Privacidade', icon: '🛡️' },
      { id: 'cobranca', label: 'Cobrança', icon: '💳' },
      { id: 'capacidades', label: 'Capacidades', icon: '📦' },
      { id: 'refletir', label: 'Refletir', icon: '🪞' },
      { id: 'tempo', label: 'Tempo e foco', icon: '⏱️' },
      { id: '23code', label: '23 Code', icon: '</>' },
    ]
  },
  {
    label: 'Aplicativo desktop',
    items: [
      { id: 'desktop-geral', label: 'Geral', icon: '🖥️' },
      { id: 'extensoes', label: 'Extensões', icon: '🧩' },
      { id: 'desenvolvedor', label: 'Desenvolvedor', icon: '🛠️' },
    ]
  },
  {
    label: 'Personalizar',
    items: [
      { id: 'habilidades', label: 'Habilidades', icon: '📋' },
      { id: 'conectores', label: 'Conectores', icon: '🔗' },
      { id: 'plugins', label: 'Plugins', icon: '🔌' },
      { id: 'memoria', label: 'Memória', icon: '🧠' },
    ]
  }
]

const ICONS = {
  '⚙️': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  '👤': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  '🛡️': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  '💳': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  '📦': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  '🪞': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>,
  '⏱️': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  '</>': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  '🖥️': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  '🧩': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  '🛠️': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  '📋': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  '🔗': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  '🔌': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8z"/></svg>,
  '🧠': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z"/><path d="M12 8v4"/><path d="M9.5 11h5"/></svg>,
  '✕': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

function getIcon(icon, size = 16) {
  const renderer = ICONS[icon]
  return renderer ? renderer(size) : null
}

export default function CustomizeModal({ onClose }) {
  const [activeItem, setActiveItem] = useState('habilidades')
  const [search, setSearch] = useState('')
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    if (activeItem === 'habilidades') {
      loadSkills()
    }
  }, [activeItem])

  const loadSkills = async () => {
    setLoading(true)
    if (window.electronAPI?.listSkills) {
      const result = await window.electronAPI.listSkills()
      if (result.success) setSkills(result.data)
    }
    setLoading(false)
  }

  const handleSaveSkill = async (fileName, content) => {
    if (window.electronAPI?.saveSkill) {
      await window.electronAPI.saveSkill(fileName, content)
      setEditingSkill(null)
      await loadSkills()
    }
  }

  const handleDeleteSkill = async (fileName) => {
    if (!confirm('Tem certeza que deseja excluir esta habilidade?')) return
    if (window.electronAPI?.deleteSkill) {
      await window.electronAPI.deleteSkill(fileName)
      await loadSkills()
    }
  }

  const handleImport = async () => {
    if (window.electronAPI?.importSkills) {
      await window.electronAPI.importSkills()
      await loadSkills()
    }
    setShowAddMenu(false)
  }

  const handleCreateNew = () => {
    setEditingSkill({ file: '', content: '', isNew: true })
    setShowAddMenu(false)
  }

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const getActiveLabel = () => {
    for (const section of MENU_SECTIONS) {
      const item = section.items.find(i => i.id === activeItem)
      if (item) return item.label
    }
    return ''
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-bg-100 rounded-2xl w-full max-w-4xl h-[600px] shadow-2xl overflow-hidden flex animate-in">

        <div className="w-56 bg-gray-50 dark:bg-bg-000 border-r border-gray-200 dark:border-border-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-border-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-text-300">
                {getIcon('🔍', 14)}
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-bg-200 border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 text-gray-900 dark:text-text-000"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {MENU_SECTIONS.map((section) => (
              <div key={section.label} className="mb-2">
                <div className="px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-text-300 uppercase tracking-wide">
                  {section.label}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item.id)
                      setEditingSkill(null)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      activeItem === item.id
                        ? 'bg-gray-200 dark:bg-bg-200 text-gray-900 dark:text-text-000 font-medium'
                        : 'text-gray-600 dark:text-text-200 hover:bg-gray-100 dark:hover:bg-bg-200'
                    }`}
                  >
                    <span className="text-gray-500 dark:text-text-300 w-4 h-4 flex items-center justify-center">
                      {getIcon(item.icon)}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {editingSkill ? (
            <SkillEditor
              skill={editingSkill}
              onSave={handleSaveSkill}
              onClose={() => setEditingSkill(null)}
            />
          ) : activeItem === 'habilidades' ? (
            <SkillsList
              skills={filteredSkills}
              loading={loading}
              search={search}
              onSearch={setSearch}
              onEdit={setEditingSkill}
              onDelete={handleDeleteSkill}
              onImport={handleImport}
              onCreateNew={handleCreateNew}
              showAddMenu={showAddMenu}
              setShowAddMenu={setShowAddMenu}
            />
          ) : (activeItem === 'geral' || activeItem === 'desktop-geral') ? (
            activeItem === 'desktop-geral' ? <DesktopGeralContent /> : <GeralContent />
          ) : activeItem === 'memoria' ? (
            <MemoryContent />
          ) : (
            <GenericContent title={getActiveLabel()} />
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 dark:text-text-300 hover:text-gray-600 dark:hover:text-text-000 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
        >
          {getIcon('✕', 18)}
        </button>
      </div>
    </div>
  )
}

function SkillsList({ skills, loading, search, onSearch, onEdit, onDelete, onImport, onCreateNew, showAddMenu, setShowAddMenu }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-text-000">Habilidades</h2>
          <button className="p-1.5 text-gray-400 dark:text-text-300 hover:text-gray-600 dark:hover:text-text-000 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors">
            {getIcon('🔍', 16)}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm text-gray-700 dark:text-text-200 bg-gray-100 dark:bg-bg-200 hover:bg-gray-200 dark:hover:bg-bg-200 rounded-lg transition-colors">
            Navegar
          </button>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1.5 text-sm text-white bg-gray-900 dark:bg-accent dark:text-bg-100 hover:bg-gray-800 dark:hover:bg-accent-light rounded-lg transition-colors flex items-center gap-1"
            >
              Adicionar
              {getIcon('▼', 10)}
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-bg-000 border border-gray-200 dark:border-border-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={onCreateNew}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200 flex items-center gap-2"
                >
                  {getIcon('✏️', 14)}
                  Criar nova habilidade
                </button>
                <button
                  onClick={onImport}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-text-200 hover:bg-gray-50 dark:hover:bg-bg-200 flex items-center gap-2"
                >
                  {getIcon('📥', 14)}
                  Importar arquivo .md
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 dark:border-border-200">
        <div className="grid grid-cols-[1fr_150px_100px_60px] gap-4 text-xs font-medium text-gray-400 dark:text-text-300 uppercase tracking-wide">
          <span>Habilidade</span>
          <span>Última atualização</span>
          <span>Autor</span>
          <span></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 dark:border-border-200 border-t-gray-900 dark:border-t-text-000 rounded-full" />
          </div>
        ) : skills.length === 0 ? (
          <EmptyState onImport={onImport} onCreateNew={onCreateNew} />
        ) : (
          skills.map((skill) => (
            <div
              key={skill.file}
              className="grid grid-cols-[1fr_150px_100px_60px] gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-bg-200 cursor-pointer border-b border-gray-50 dark:border-border-200 transition-colors group"
              onClick={() => onEdit(skill)}
            >
              <span className="text-sm font-medium text-gray-900 dark:text-text-000">{skill.name}</span>
              <span className="text-sm text-gray-500 dark:text-text-300">{skill.updated}</span>
              <span className="text-sm text-gray-500 dark:text-text-300">{skill.author}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(skill.file)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-text-300 hover:text-red-500 transition-all"
              >
                {getIcon('🗑️', 14)}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ onImport, onCreateNew }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-bg-200 flex items-center justify-center mb-4">
        {getIcon('📄', 32)}
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-text-000 mb-1">Nenhuma habilidade encontrada</h3>
      <p className="text-sm text-gray-500 dark:text-text-300 mb-6">
        Adicione habilidades para personalizar o comportamento da IA
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCreateNew}
          className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-accent text-white dark:text-bg-100 rounded-lg hover:bg-gray-800 dark:hover:bg-accent-light transition-colors flex items-center gap-2"
        >
          {getIcon('➕', 14)}
          Criar habilidade
        </button>
        <button
          onClick={onImport}
          className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-bg-200 text-gray-700 dark:text-text-200 rounded-lg hover:bg-gray-200 dark:hover:bg-bg-200 transition-colors flex items-center gap-2"
        >
          {getIcon('📥', 14)}
          Importar .md
        </button>
      </div>
    </div>
  )
}

function SkillEditor({ skill, onSave, onClose }) {
  const [content, setContent] = useState(skill?.content || '')
  const [fileName, setFileName] = useState(skill?.file?.replace('.md', '') || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!fileName.trim()) return
    setSaving(true)
    const name = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    await onSave(name, content)
    setSaving(false)
  }

  useEffect(() => {
    const loadContent = async () => {
      if (skill?.file && !skill.isNew && window.electronAPI?.readSkill) {
        const result = await window.electronAPI.readSkill(skill.file)
        if (result.success) setContent(result.data)
      }
    }
    loadContent()
  }, [skill])

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 dark:text-text-300 hover:text-gray-600 dark:hover:text-text-000 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
          >
            {getIcon('◀️', 18)}
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-text-000">
            {skill.isNew ? 'Nova Habilidade' : 'Editar Habilidade'}
          </h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !fileName.trim()}
          className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-bg-100 text-white dark:text-text-000 rounded-lg hover:bg-gray-800 dark:hover:bg-bg-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white/30 dark:border-text-000/30 border-t-white dark:border-t-text-000 rounded-full" />
              Salvando...
            </>
          ) : (
            'Salvar'
          )}
        </button>
      </div>

      <div className="px-6 py-4 border-b border-gray-100 dark:border-border-200">
        <label className="block text-sm font-medium text-gray-700 dark:text-text-200 mb-2">Nome do arquivo</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="minha-habilidade"
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-border-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-text-000/10 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000"
          />
          <span className="text-sm text-gray-500 dark:text-text-300">.md</span>
        </div>
      </div>

      <div className="flex-1 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-text-200 mb-2">Conteúdo (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="# Minha Habilidade&#10;&#10;Descreva o comportamento da IA aqui..."
          className="w-full h-full px-4 py-3 border border-gray-200 dark:border-border-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-text-000/10 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000"
        />
      </div>
    </div>
  )
}

function GeralContent() {
  const { user, updateUser, uploadPhoto, theme, setTheme } = useUser()
  const [name, setName] = useState(user.name || '')
  const [displayName, setDisplayName] = useState(user.name || '')
  const [job, setJob] = useState('Outro')
  const [instructions, setInstructions] = useState(user.instructions || '')
  const [motion, setMotion] = useState('system')

  const handleNameChange = (value) => {
    setName(value)
    updateUser({ name: value })
  }

  const handleDisplayNameChange = (value) => {
    setDisplayName(value)
    updateUser({ displayName: value })
  }

  const handleInstructionsChange = (value) => {
    setInstructions(value)
    updateUser({ instructions: value })
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (file) await uploadPhoto(file)
  }

  const themes = [
    { value: 'system', label: 'Sistema', icon: '🖥️' },
    { value: 'light', label: 'Claro', icon: '☀️' },
    { value: 'dark', label: 'Escuro', icon: '🌙' },
  ]

  const motionOptions = [
    { value: 'system', label: 'Sistema' },
    { value: 'reduce', label: 'Reduzido' },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <div className="flex flex-col gap-6">

        <section>
          <h3 className="text-base font-semibold text-gray-900 dark:text-text-000 mb-4">Perfil</h3>
          <div className="divide-y divide-gray-100 dark:divide-border-200">

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Avatar</div>
              </div>
              <div className="flex items-center">
                <div className="group relative">
                  <label className="w-10 h-10 rounded-full bg-gray-200 dark:bg-bg-200 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-text-200 hover:opacity-80 transition-opacity cursor-pointer overflow-hidden">
                    {user.photo ? (
                      <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{user.name ? user.name[0].toUpperCase() : '?'}</span>
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs">Alterar</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Nome completo</div>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-56 px-3 py-2 border border-gray-200 dark:border-border-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000"
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Como a IA deveria te chamar?</div>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                className="w-56 px-3 py-2 border border-gray-200 dark:border-border-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000"
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">O que melhor descreve seu trabalho?</div>
              </div>
              <select
                value={job}
                onChange={(e) => setJob(e.target.value)}
                className="w-56 px-3 py-2 border border-gray-200 dark:border-border-200 rounded-lg text-sm bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30"
              >
                <option>Engenheiro de Software</option>
                <option>Designer</option>
                <option>Produto</option>
                <option>Marketing</option>
                <option>Vendas</option>
                <option>Suporte</option>
                <option>Outro</option>
              </select>
            </div>

            <div className="py-4">
              <div className="mb-2">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Instruções para a IA</div>
                <p className="text-xs text-gray-500 dark:text-text-300 mt-1">A IA levará isso em conta em todos os chats.</p>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                placeholder="ex.: respostas diretas e objetivas"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 dark:border-border-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000 max-h-40"
              />
            </div>

          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-gray-900 dark:text-text-000 mb-4">Preferências</h3>
          <div className="divide-y divide-gray-100 dark:divide-border-200">

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Aparência</div>
              </div>
              <div className="flex bg-gray-100 dark:bg-bg-200 rounded-lg p-1">
                {themes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      theme === t.value
                        ? 'bg-white dark:bg-bg-100 text-gray-900 dark:text-text-000 shadow-sm'
                        : 'text-gray-600 dark:text-text-200 hover:text-gray-900 dark:hover:text-text-000'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Movimento</div>
                <p className="text-xs text-gray-500 dark:text-text-300 mt-1">Reduzir animações em respostas e outros elementos.</p>
              </div>
              <div className="flex bg-gray-100 dark:bg-bg-200 rounded-lg p-1">
                {motionOptions.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMotion(m.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      motion === m.value
                        ? 'bg-white dark:bg-bg-100 text-gray-900 dark:text-text-000 shadow-sm'
                        : 'text-gray-600 dark:text-text-200 hover:text-gray-900 dark:hover:text-text-000'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}

function DesktopGeralContent() {
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [quickAccessKey, setQuickAccessKey] = useState('Control+Alt+Space')
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [keepAwake, setKeepAwake] = useState(false)

  const handleToggleStartup = async () => {
    const newValue = !launchAtStartup
    setLaunchAtStartup(newValue)
    if (window.electronAPI?.setLaunchAtStartup) {
      await window.electronAPI.setLaunchAtStartup(newValue)
    }
  }

  const handleToggleTray = () => {
    setMinimizeToTray(!minimizeToTray)
  }

  const handleToggleKeepAwake = () => {
    setKeepAwake(!keepAwake)
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <div className="flex flex-col gap-6">

        <section>
          <h3 className="text-base font-semibold text-gray-900 dark:text-text-000 mb-4">Configurações gerais da área de trabalho</h3>
          <div className="divide-y divide-gray-100 dark:divide-border-200">

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Executar na inicialização</div>
                <div className="text-xs text-gray-500 dark:text-text-300 mt-0.5">Iniciar automaticamente o 23 Code quando você fizer login no seu computador</div>
              </div>
              <button
                onClick={handleToggleStartup}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  launchAtStartup ? 'bg-blue-600' : 'bg-gray-300 dark:bg-bg-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    launchAtStartup ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Atalho de teclado da Entrada Rápida</div>
                <div className="text-xs text-gray-500 dark:text-text-300 mt-0.5">Abra o 23 Code rapidamente de qualquer lugar</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-bg-200 border border-gray-200 dark:border-border-200 rounded-lg text-gray-900 dark:text-text-000">
                  {quickAccessKey}
                </span>
                <button
                  onClick={() => setQuickAccessKey('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-text-300 dark:hover:text-text-000 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Bandeja do sistema</div>
                <div className="text-xs text-gray-500 dark:text-text-300 mt-0.5">Manter o 23 Code em execução na bandeja do sistema</div>
              </div>
              <button
                onClick={handleToggleTray}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  minimizeToTray ? 'bg-blue-600' : 'bg-gray-300 dark:bg-bg-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    minimizeToTray ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">Manter computador ativo</div>
                <div className="text-xs text-gray-500 dark:text-text-300 mt-0.5">
                  Impede que seu computador entre em suspensão por inatividade enquanto o 23 Code estiver aberto para que as tarefas agendadas possam ser executadas. Sua tela ainda pode desligar. Fechar a tampa do laptop ainda colocará o computador em suspensão.
                </div>
              </div>
              <button
                onClick={handleToggleKeepAwake}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  keepAwake ? 'bg-gray-300' : 'bg-gray-300 dark:bg-bg-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    keepAwake ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}

function GenericContent({ title }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        {getIcon('ℹ️', 32)}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">Em breve disponível</p>
    </div>
  )
}

function MemoryContent() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [newMemoryTitle, setNewMemoryTitle] = useState('')
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState('outros')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    loadMemories()
    loadSettings()
  }, [])

  const loadMemories = async () => {
    setLoading(true)
    if (window.electronAPI?.listMemories) {
      const result = await window.electronAPI.listMemories()
      if (result.success) setMemories(result.data)
    }
    setLoading(false)
  }

  const loadSettings = async () => {
    if (window.electronAPI?.getMemorySettings) {
      const result = await window.electronAPI.getMemorySettings()
      if (result.success) setAutoGenerate(result.data.autoGenerate)
    }
  }

  const handleToggleAutoGenerate = async () => {
    const newValue = !autoGenerate
    setAutoGenerate(newValue)
    if (window.electronAPI?.saveMemorySettings) {
      await window.electronAPI.saveMemorySettings({ autoGenerate: newValue })
    }
  }

  const handleCreateMemory = async () => {
    if (!newMemoryTitle.trim()) return
    if (window.electronAPI?.createMemory) {
      await window.electronAPI.createMemory({
        category: newMemoryCategory,
        title: newMemoryTitle.trim(),
        content: newMemoryContent.trim(),
      })
      setNewMemoryTitle('')
      setNewMemoryContent('')
      setNewMemoryCategory('outros')
      await loadMemories()
    }
  }

  const handleDeleteMemory = async (id) => {
    if (window.electronAPI?.deleteMemory) {
      await window.electronAPI.deleteMemory(id)
      await loadMemories()
    }
  }

  const handleStartEdit = (memory) => {
    setEditingId(memory.id)
    setEditTitle(memory.title)
    setEditContent(memory.content)
  }

  const handleSaveEdit = async () => {
    if (window.electronAPI?.updateMemory) {
      await window.electronAPI.updateMemory(editingId, {
        title: editTitle,
        content: editContent,
      })
      setEditingId(null)
      await loadMemories()
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const day = d.getDate()
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${day} de ${months[d.getMonth()]}`
  }

  const categorized = memories.reduce((acc, m) => {
    const cat = m.category || 'outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

  const categoryLabels = {
    perfil: 'Você',
    topicos: 'Tópicos',
    areas: 'Áreas',
    outros: 'Outros',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-border-200">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-text-000">Memória</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-border-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-text-000">Gerar memória a partir de conversas</div>
              <div className="text-xs text-gray-500 dark:text-text-300 mt-0.5">Permitir que a IA gere memória a partir das suas conversas.</div>
            </div>
            <button
              onClick={handleToggleAutoGenerate}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoGenerate ? 'bg-gray-900 dark:bg-accent' : 'bg-gray-200 dark:bg-bg-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoGenerate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 dark:border-border-200 border-t-gray-900 dark:border-t-text-000 rounded-full" />
          </div>
        ) : (
          <>
            {Object.entries(categoryLabels).map(([key, label]) => {
              const items = categorized[key]
              if (!items || items.length === 0) return null
              return (
                <div key={key} className="border-b border-gray-100 dark:border-border-200">
                  <div className="px-6 py-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-text-300 uppercase tracking-wide">{label}</h3>
                  </div>
                  {items.map(memory => (
                    <div key={memory.id} className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors group">
                      {editingId === memory.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000"
                          />
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1 text-xs font-medium bg-gray-900 dark:bg-accent text-white dark:text-bg-100 rounded-md hover:bg-gray-800 dark:hover:bg-accent-light transition-colors"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-text-200 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-md transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleStartEdit(memory)}>
                            <div className="text-sm font-medium text-gray-900 dark:text-text-000">{memory.title}</div>
                            <div className="text-xs text-gray-500 dark:text-text-300 truncate">{memory.content}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400 dark:text-text-300">{formatDate(memory.updatedAt)}</span>
                            <button
                              onClick={() => handleDeleteMemory(memory.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-text-300 hover:text-red-500 transition-all"
                            >
                              {getIcon('🗑️', 14)}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}

            {memories.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-text-300">Nenhuma memória criada ainda.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-100 dark:border-border-200">
        <div className="flex items-end gap-2">
          <select
            value={newMemoryCategory}
            onChange={(e) => setNewMemoryCategory(e.target.value)}
            className="px-2 py-2 text-xs border border-gray-200 dark:border-border-200 rounded-lg bg-white dark:bg-bg-200 text-gray-700 dark:text-text-200 focus:outline-none"
          >
            <option value="perfil">Você</option>
            <option value="topicos">Tópicos</option>
            <option value="areas">Áreas</option>
            <option value="outros">Outros</option>
          </select>
          <input
            type="text"
            value={newMemoryTitle}
            onChange={(e) => setNewMemoryTitle(e.target.value)}
            placeholder="Título"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateMemory()}
          />
          <input
            type="text"
            value={newMemoryContent}
            onChange={(e) => setNewMemoryContent(e.target.value)}
            placeholder="Conteúdo"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-border-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-accent/30 bg-white dark:bg-bg-200 text-gray-900 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateMemory()}
          />
          <button
            onClick={handleCreateMemory}
            disabled={!newMemoryTitle.trim()}
            className="h-9 w-9 rounded-lg flex items-center justify-center bg-gray-900 dark:bg-accent text-white dark:text-bg-100 hover:bg-gray-800 dark:hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
