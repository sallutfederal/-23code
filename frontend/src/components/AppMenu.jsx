import { useState, useEffect, useRef } from 'react'

const MENU_ITEMS = [
  {
    label: 'Arquivo',
    submenu: ['Novo chat', 'Nova janela', 'Salvar', 'Exportar', 'Sair']
  },
  {
    label: 'Editar',
    submenu: ['Desfazer', 'Refazer', 'Copiar', 'Colar', 'Selecionar tudo']
  },
  {
    label: 'Visualizar',
    submenu: ['Sidebar', 'Zoom', 'Tela cheia', 'Developer Tools']
  },
  {
    label: 'Ajuda',
    submenu: ['Documentação', 'Atalhos de teclado', 'Sobre', 'Verificar atualizações']
  }
]

function AppMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
        setActiveSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setActiveSubmenu(null)
        }}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[100]">
          {MENU_ITEMS.map((item, i) => (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setActiveSubmenu(i)}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <span>{item.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {activeSubmenu === i && (
                <div className="absolute left-full top-0 ml-0.5 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                  {item.submenu.map((sub, j) => (
                    <button
                      key={j}
                      onClick={() => {
                        console.log(`${item.label} > ${sub}`)
                        setIsOpen(false)
                        setActiveSubmenu(null)
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AppMenu
