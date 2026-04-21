import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiUrl } from '@/lib/apiBase'

export type AuthContextValue = {
  oauthOn: boolean
  /** null = OAuth aus */
  sessionOk: boolean | null
  systemAccess: boolean
  authResolved: boolean
  authError: string | null
  authLoading: boolean
  loadAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [oauthOn, setOauthOn] = useState(false)
  const [sessionOk, setSessionOk] = useState<boolean | null>(null)
  const [systemAccess, setSystemAccess] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const loadAuth = useCallback(async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const rCfg = await fetch(apiUrl('/api/auth/config'))
      if (!rCfg.ok) throw new Error(`Auth-Konfig nicht erreichbar (HTTP ${rCfg.status})`)
      const jCfg = await rCfg.json()
      const on = Boolean(jCfg.oauthConfigured)
      setOauthOn(on)
      if (!on) {
        setSessionOk(null)
        setSystemAccess(false)
        setAuthResolved(true)
        return
      }
      const rMe = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      if (!rMe.ok) throw new Error(`Auth-Status nicht erreichbar (HTTP ${rMe.status})`)
      const jMe = await rMe.json().catch(() => ({}))
      const ok = Boolean(jMe.ok)
      setSessionOk(ok)
      setSystemAccess(ok ? Boolean(jMe.systemAccess) : false)
      setAuthResolved(true)
    } catch {
      setAuthError('Auth-Prüfung fehlgeschlagen. Bitte kurz warten und erneut versuchen.')
      // Fallback: UI nicht in der "Erneut prüfen"-Ansicht festhängen lassen,
      // wenn die Auth-API temporär nicht erreichbar ist.
      setOauthOn(false)
      setSessionOk(null)
      setSystemAccess(false)
      setAuthResolved(true)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAuth()
  }, [loadAuth])

  const value = useMemo(
    () => ({
      oauthOn,
      sessionOk,
      systemAccess,
      authResolved,
      authError,
      authLoading,
      loadAuth,
    }),
    [oauthOn, sessionOk, systemAccess, authResolved, authError, authLoading, loadAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth nur innerhalb von AuthProvider')
  return ctx
}
