import { createContext, useContext, useState, useEffect } from 'react'

const UserContext = createContext()

const DEFAULT_USER = {
  name: 'escobar',
  email: '',
  photo: null,
  plan: 'Free',
  instructions: ''
}

const DEFAULT_THEME = 'system'

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user-data')
    return saved ? JSON.parse(saved) : DEFAULT_USER
  })

  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || DEFAULT_THEME
  })

  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    localStorage.setItem('user-data', JSON.stringify(user))
  }, [user])

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const updateUser = (data) => {
    setUser(prev => ({ ...prev, ...data }))
  }

  const uploadPhoto = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result
        updateUser({ photo: base64 })
        resolve(base64)
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = () => {
    updateUser({ photo: null })
  }

  return (
    <UserContext.Provider value={{ user, updateUser, uploadPhoto, removePhoto, showSettings, setShowSettings, theme, setTheme }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}
