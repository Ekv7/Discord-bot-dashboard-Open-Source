import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { DashboardLoginScreen } from '@/components/DashboardLoginScreen'
import { useAuth } from '@/auth/AuthContext'
import { apiUrl } from '@/lib/apiBase'

function buildOAuthDiscordHref(from: { pathname: string; search?: string } | undefined): string {
  const target = from ? `${from.pathname}${from.search || ''}` : '/'
  const next = target.startsWith('/login') ? '/' : target
  return `${apiUrl('/api/auth/discord')}?next=${encodeURIComponent(next)}`
}

export function LoginPage() {
  const { oauthOn, sessionOk, authResolved, authLoading, loadAuth } = useAuth()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from
  const discordHref = useMemo(() => buildOAuthDiscordHref(from), [from])

  const redirectAfterLogin =
    from && !from.pathname.startsWith('/login') ? `${from.pathname}${from.search || ''}` : '/'

  if (!authResolved) {
    return (
      <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center bg-[var(--main-black)] px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/70 p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Lade Auth…</p>
        </div>
      </div>
    )
  }

  if (!oauthOn) {
    return <Navigate to="/" replace />
  }

  if (sessionOk === true) {
    return <Navigate to={redirectAfterLogin} replace />
  }

  return (
    <DashboardLoginScreen
      authLoading={authLoading}
      onReload={() => void loadAuth()}
      discordHref={discordHref}
    />
  )
}
