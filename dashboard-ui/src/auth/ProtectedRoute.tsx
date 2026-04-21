import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Mit aktivem OAuth: nur mit gültiger Session. Ohne OAuth: Dashboard wie bisher offen.
 * `children` direkt rendern (kein verschachteltes <Outlet/>), damit Deep-Links wie /stats zuverlässig matchen.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { oauthOn, sessionOk, authResolved, authLoading, authError, loadAuth } = useAuth()
  const location = useLocation()

  if (!authResolved) {
    return (
      <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center bg-[var(--main-black)] px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/70 p-6 text-center">
          <p className="text-sm text-[var(--muted)]">{authError || 'Zugriffe werden geprüft...'}</p>
          <div className="mt-4">
            <button
              type="button"
              className="dash-btn px-4"
              disabled={authLoading}
              onClick={() => void loadAuth()}
            >
              {authLoading ? 'Lade...' : 'Erneut prüfen'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (oauthOn && sessionOk === false) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
