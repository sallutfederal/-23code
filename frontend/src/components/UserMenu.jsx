import { useUser } from '../context/UserContext'

function UserMenu({ onClose }) {
  const { user, setShowSettings } = useUser()

  const handleItemClick = (id) => {
    if (id === 'settings') {
      setShowSettings(true)
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} />
      <div className="fixed bottom-14 left-3 w-[280px] bg-white dark:bg-bg-000 rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)] z-[100] overflow-hidden">

        <div className="min-h-0 overflow-y-auto p-1">

          <MenuItem
            icon={<SettingsIcon />}
            label="Configurações"
            shortcut="Ctrl+,"
            onClick={() => handleItemClick('settings')}
          />

          <MenuItem
            icon={<GlobeIcon />}
            label="Idioma"
            hasArrow
            onClick={onClose}
          />

          <MenuItem
            icon={<HelpIcon />}
            label="Receber ajuda"
            onClick={onClose}
          />

          <div className="mx-2.5 my-1 h-px bg-gray-100 dark:bg-border-200" />

          <MenuItem
            icon={<BoltIcon />}
            label="Fazer upgrade do plano"
            onClick={onClose}
          />

          <MenuItem
            icon={<MonitorIcon />}
            label="Obter apps e extensões"
            onClick={onClose}
          />

          <MenuItem
            icon={<InfoIcon />}
            label="Saiba mais"
            hasArrow
            onClick={onClose}
          />

          <div className="mx-2.5 my-1 h-px bg-gray-100 dark:bg-border-200" />

          <MenuItem
            icon={<LogoutIcon />}
            label="Sair"
            onClick={onClose}
          />

        </div>

      </div>
    </>
  )
}

function MenuItem({ icon, label, shortcut, hasArrow, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 dark:text-text-100 hover:bg-gray-50 dark:hover:bg-bg-200 transition-colors select-none outline-none"
    >
      <span className="flex items-center justify-center w-5 h-5 text-gray-500 dark:text-text-300 shrink-0">
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {shortcut && (
        <span className="flex items-center gap-0.5 text-xs text-gray-400 dark:text-text-300">
          <kbd className="text-[11px]">Ctrl</kbd>
          <span className="opacity-60">+</span>
          <kbd className="text-[11px]">⇧</kbd>
          <span className="opacity-60">+</span>
          <kbd className="text-[11px]">,</kbd>
        </span>
      )}
      {hasArrow && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-text-300 shrink-0">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      )}
    </button>
  )
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export default UserMenu
