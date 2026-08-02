import { useState, useRef, useEffect } from 'react'
import { AI_MODELS, DEFAULT_MODEL } from '../config/model'
import { useProject } from '../context/ProjectContext'
import ProjectChip from './ProjectChip'
import ProjectModal from './ProjectModal'

function ChatInput({ onSend, placeholder, selectedModel, onModelChange, disabled }) {
  const { activeProject, projects, loading, selectProject, addProject } = useProject()
  const [text, setText] = useState('')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [skills, setSkills] = useState([])
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [attachments, setAttachments] = useState([])
  const textareaRef = useRef(null)
  const modelMenuRef = useRef(null)
  const slashMenuRef = useRef(null)
  const attachMenuRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cursorPosRef = useRef(0)

  const currentModel = selectedModel || DEFAULT_MODEL

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(slashFilter.toLowerCase())
  )

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 384) + 'px'
    }
  }, [text])

  useEffect(() => {
    const loadSkills = async () => {
      if (window.electronAPI?.listSkills) {
        const result = await window.electronAPI.listSkills()
        if (result.success) setSkills(result.data)
      }
    }
    loadSkills()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setShowModelMenu(false)
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setShowSlashMenu(false)
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = () => {
    if (disabled) return
    if (text.trim() || attachments.length > 0) {
      onSend(text.trim(), attachments)
      setText('')
      setAttachments([])
      setShowSlashMenu(false)
      setShowAttachMenu(false)
    }
  }

  const handleFileSelect = async (e, type) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newAttachments = []

    for (const file of files) {
      const attachment = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        isImage: file.type.startsWith('image/'),
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        const dataUrl = await new Promise(resolve => {
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(file)
        })
        attachment.preview = dataUrl
        attachment.content = dataUrl
      } else {
        const reader = new FileReader()
        const content = await new Promise(resolve => {
          reader.onload = () => resolve(reader.result)
          reader.readAsText(file)
        })
        attachment.content = content
      }

      newAttachments.push(attachment)
    }

    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = ''
    setShowAttachMenu(false)
  }

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSlashSelect = async (skill) => {
    if (window.electronAPI?.readSkill) {
      const result = await window.electronAPI.readSkill(skill.file)
      if (result.success) {
        const beforeSlash = text.slice(0, cursorPosRef.current - 1)
        const afterCursor = text.slice(cursorPosRef.current)
        const newText = `${beforeSlash}@${skill.name} ${afterCursor}`.trim()
        setText(newText)
        setTimeout(() => {
          const pos = beforeSlash.length + skill.name.length + 2
          textareaRef.current?.setSelectionRange(pos, pos)
          textareaRef.current?.focus()
        }, 0)
      }
    }
    setShowSlashMenu(false)
  }

  const handleKeyDown = (e) => {
    if (showSlashMenu && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSlashIndex(i => (i + 1) % filteredSkills.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSlashIndex(i => (i - 1 + filteredSkills.length) % filteredSkills.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSlashSelect(filteredSkills[selectedSlashIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e) => {
    const value = e.target.value
    const pos = e.target.selectionStart
    setText(value)
    cursorPosRef.current = pos

    const textBeforeCursor = value.slice(0, pos)
    const lastNewline = textBeforeCursor.lastIndexOf('\n')
    const currentLine = textBeforeCursor.slice(lastNewline + 1)

    if (currentLine === '/') {
      setShowSlashMenu(true)
      setSlashFilter('')
      setSelectedSlashIndex(0)
    } else if (showSlashMenu) {
      if (currentLine.startsWith('/')) {
        setSlashFilter(currentLine.slice(1))
        setSelectedSlashIndex(0)
      } else {
        setShowSlashMenu(false)
      }
    }
  }

  return (
    <div className="relative">
      {showSlashMenu && filteredSkills.length > 0 && (
        <div
          ref={slashMenuRef}
          className="absolute bottom-full mb-2 left-0 right-0 max-h-64 overflow-y-auto bg-white dark:bg-bg-000 border border-gray-200 dark:border-border-200 rounded-xl shadow-lg z-50 py-2"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-text-300 uppercase tracking-wide">
            Habilidades
          </div>
          {filteredSkills.map((skill, i) => (
            <button
              key={skill.file}
              onClick={() => handleSlashSelect(skill)}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors flex items-start gap-3 ${
                i === selectedSlashIndex ? 'bg-gray-50 dark:bg-bg-200' : ''
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-bg-200 flex items-center justify-center text-gray-500 dark:text-text-300 shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-text-000">{skill.name}</div>
                <div className="text-xs text-gray-500 dark:text-text-300 truncate">{skill.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mx-2 md:mx-0 flex flex-col bg-white dark:bg-bg-000 items-stretch rounded-[20px] cursor-text relative z-[1] border border-gray-200 dark:border-border-200 shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.035),0_0_0_0.5px_rgba(0,0,0,0.08)] hover:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.035),0_0_0_0.5px_rgba(0,0,0,0.12)] focus-within:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.07),0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.3)] dark:hover:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.4)] dark:focus-within:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.5)] transition-shadow duration-200">

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex gap-2 p-3 pb-0 flex-wrap">
            {attachments.map(att => (
              <div key={att.id} className="relative group">
                {att.isImage ? (
                  <img src={att.preview} alt={att.name} className="h-20 rounded-lg object-cover border border-gray-200 dark:border-border-200" />
                ) : (
                  <div className="h-20 w-32 rounded-lg border border-gray-200 dark:border-border-200 bg-gray-50 dark:bg-bg-200 flex flex-col items-center justify-center p-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-text-300 mb-1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="text-[10px] text-gray-500 dark:text-text-300 text-center truncate w-full">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col m-3.5 gap-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={attachments.length > 0 ? 'Adicione uma mensagem...' : placeholder}
              rows={1}
              disabled={disabled}
              className="w-full overflow-y-auto break-words transition-opacity duration-200 text-base max-h-96 min-h-[calc(2lh+6px)] pl-[6px] pt-[6px] pr-4 pb-2 resize-none bg-transparent focus:outline-none text-gray-800 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Project Chip */}
          <ProjectChip 
            project={activeProject} 
            onClick={() => setShowProjectModal(true)} 
          />

          <div className="relative flex items-center w-full gap-2">
            <div className="relative shrink-0 flex items-center gap-1" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="group relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 dark:text-text-300 hover:bg-gray-100 dark:hover:bg-bg-200 transition-colors"
                title="Adicionar arquivos"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-52 bg-white dark:bg-bg-000 border border-gray-200 dark:border-border-200 rounded-xl shadow-lg z-50 py-1">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 dark:text-text-300">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-text-000">Imagens</div>
                      <div className="text-xs text-gray-500 dark:text-text-300">PNG, JPG, GIF</div>
                    </div>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 dark:text-text-300">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-text-000">Arquivos</div>
                      <div className="text-xs text-gray-500 dark:text-text-300">TXT, JSON, JS, etc.</div>
                    </div>
                  </button>
                </div>
              )}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'image')}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.js,.ts,.jsx,.tsx,.css,.html,.md,.py,.java,.c,.cpp,.h,.rb,.go,.rs,.yml,.yaml,.xml,.env,.log,.csv,.sql,.sh,.bat"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'file')}
              />
            </div>

            <div className="grow" />

            <div className="flex items-center gap-2">
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-text-200 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
                >
                  <span className="text-sm">{currentModel.name}</span>
                  <span className="text-gray-400 dark:text-text-300">{currentModel.tier}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-75">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showModelMenu && (
                  <div className="absolute bottom-full mb-2 left-0 w-56 bg-white dark:bg-bg-000 border border-gray-200 dark:border-border-200 rounded-xl shadow-lg z-50 py-1">
                    {AI_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onModelChange?.(model)
                          setShowModelMenu(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors flex items-center justify-between ${
                          currentModel.id === model.id ? 'bg-gray-50 dark:bg-bg-200' : ''
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-text-000">{model.name}</div>
                          <div className="text-xs text-gray-500 dark:text-text-300">{model.provider}</div>
                        </div>
                        {currentModel.id === model.id && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-900 dark:text-text-000">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="h-8 rounded-lg flex items-center justify-center px-1.5 hover:bg-gray-100 dark:hover:bg-bg-200 transition-colors text-gray-500 dark:text-text-300"
                title="Pressione e segure para gravar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="11" rx="3"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={disabled || (!text.trim() && attachments.length === 0)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#1e1e3a] dark:bg-accent text-white hover:bg-[#2a2a4a] dark:hover:bg-accent-light"
                title="Enviar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Project Selection Modal */}
      <ProjectModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        projects={projects}
        activeProject={activeProject}
        onSelect={selectProject}
        onAdd={addProject}
        loading={loading}
      />
    </div>
  )
}

export default ChatInput
