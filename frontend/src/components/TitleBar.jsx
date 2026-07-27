import { useState, useEffect } from 'react'
import AppMenu from './AppMenu'
import CommandPalette from './CommandPalette'

function TitleBar({ onToggleSidebar }) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <>
      <div className="flex items-center justify-between h-10 bg-white dark:bg-bg-100 border-b border-gray-100 dark:border-border-300 select-none"
           style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-0.5 px-2">
          <AppMenu />
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-md transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Toggle Sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700 dark:text-text-200">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-bg-200 rounded-md transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Buscar conversas (Ctrl+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700 dark:text-text-200">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={handleMinimize}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-bg-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect fill="currentColor" x="1" y="5.5" width="10" height="1"/>
            </svg>
          </button>
          <button onClick={handleMaximize}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-bg-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect fill="none" stroke="currentColor" x="1.5" y="1.5" width="9" height="9"/>
            </svg>
          </button>
          <button onClick={handleClose}
                  className="p-2 hover:bg-red-500 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line stroke="currentColor" x1="1" y1="1" x2="11" y2="11" strokeWidth="1.5"/>
              <line stroke="currentColor" x1="11" y1="1" x2="1" y2="11" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

export default TitleBar
