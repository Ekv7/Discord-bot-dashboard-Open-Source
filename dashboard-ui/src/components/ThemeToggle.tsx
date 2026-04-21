import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'mynex-dashboard-theme'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [light, setLight] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'light'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('light', light)
    try {
      localStorage.setItem(STORAGE_KEY, light ? 'light' : 'dark')
    } catch {
      /* ignore */
    }
  }, [light])

  return (
    <button
      type="button"
      className={`dash-btn h-9 px-3 ${className}`.trim()}
      onClick={() => setLight((v) => !v)}
      aria-label={light ? 'Dunkles Theme' : 'Helles Theme'}
    >
      {light ? <Moon className="h-4 w-4 shrink-0" aria-hidden /> : <Sun className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="hidden sm:inline">Theme</span>
    </button>
  )
}
