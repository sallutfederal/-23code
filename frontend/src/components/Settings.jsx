import { useState, useRef } from 'react'
import { useUser } from '../context/UserContext'
import { useProject } from '../context/ProjectContext'
import PermissionsSettings from './PermissionsSettings'

const TABS = [
  { id: 'profile', label: 'Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'permissions', label: 'Permissões', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
]

function Settings() {
  const { user, updateUser, uploadPhoto, removePhoto, setShowSettings } = useUser()
  const { activeProject } = useProject()
  const [activeTab, setActiveTab] = useState('profile')
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [preview, setPreview] = useState(user.photo)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB')
      return
    }

    const base64 = await uploadPhoto(file)
    setPreview(base64)
  }

  const handleRemovePhoto = () => {
    removePhoto()
    setPreview(null)
  }

  const handleSave = () => {
    setSaving(true)

    setTimeout(() => {
      updateUser({ name, email, photo: preview })
      setSaving(false)
      setSaved(true)

      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }

  const getInitials = (n) => {
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-bg-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-text-000">Configurações</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-border-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-gray-900 dark:border-text-000 text-gray-900 dark:text-text-000'
                  : 'border-transparent text-gray-500 dark:text-text-300 hover:text-gray-700 dark:hover:text-text-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Tab: Perfil */}
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-bg-000 border-2 border-gray-200 dark:border-border-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    {preview ? (
                      <img src={preview} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold text-gray-500 dark:text-text-200">
                        {name ? getInitials(name) : '?'}
                      </span>
                    )}
                  </button>

                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                       onClick={() => fileInputRef.current?.click()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-text-200 mb-1">Foto de perfil</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-bg-000 text-gray-700 dark:text-text-200 rounded-lg hover:bg-gray-200 dark:hover:bg-bg-200 transition-colors"
                    >
                      Alterar foto
                    </button>
                    {preview && (
                      <button
                        onClick={handleRemovePhoto}
                        className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-text-200">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-border-200 rounded-xl text-sm text-gray-900 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-text-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all bg-white dark:bg-bg-000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-text-200">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-border-200 rounded-xl text-sm text-gray-900 dark:text-text-000 placeholder-gray-400 dark:placeholder-text-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-text-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all bg-white dark:bg-bg-000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-text-200">Plano</label>
                <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-border-200 rounded-xl">
                  <span className="text-sm text-gray-900 dark:text-text-000">{user.plan}</span>
                  <span className="text-xs bg-gray-100 dark:bg-bg-000 text-gray-500 dark:text-text-200 px-2 py-0.5 rounded-full">Atual</span>
                </div>
              </div>
            </>
          )}

          {/* Tab: Permissões */}
          {activeTab === 'permissions' && (
            <PermissionsSettings projectId={activeProject?.id} />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-border-200 bg-gray-50/50 dark:bg-bg-000/50">
          <p className="text-xs text-gray-400 dark:text-text-300">
            As alterações são salvas localmente
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-sm text-gray-600 dark:text-text-200 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            {activeTab === 'profile' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-text-000 text-white dark:text-bg-100 rounded-lg hover:bg-gray-800 dark:hover:bg-text-100 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Salvando...
                  </>
                ) : saved ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Salvo!
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
