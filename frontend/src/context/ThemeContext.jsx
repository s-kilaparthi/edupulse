import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const ThemeContext = createContext(null)

function applyThemeToDocument(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function ThemeProvider({ session, children }) {
  const [theme, setTheme] = useState('light')
  const [themeLoaded, setThemeLoaded] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) {
      applyThemeToDocument('light')
      setTheme('light')
      setThemeLoaded(true)
      return
    }

    let cancelled = false

    async function loadTheme() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('theme')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        const nextTheme = !error && data?.theme === 'dark' ? 'dark' : 'light'
        setTheme(nextTheme)
        applyThemeToDocument(nextTheme)
      } catch {
        if (cancelled) return
        setTheme('light')
        applyThemeToDocument('light')
      } finally {
        if (!cancelled) {
          setThemeLoaded(true)
        }
      }
    }

    loadTheme()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const toggleTheme = useCallback(async () => {
    if (!session?.user?.id) return

    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyThemeToDocument(nextTheme)

    await supabase
      .from('users')
      .update({ theme: nextTheme })
      .eq('id', session.user.id)
  }, [session?.user?.id, theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeLoaded }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
