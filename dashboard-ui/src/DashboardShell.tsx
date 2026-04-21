import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '@/lib/apiBase'
import {
  LayoutDashboard,
  ScrollText,
  Terminal,
  BarChart3,
  Hash,
  Power,
  Wrench,
  UserRound,
  AlertTriangle,
  Sparkles,
  Gavel,
  Menu,
  X,
  Users,
  UserPlus,
} from 'lucide-react'
import { useSnapshot } from '@/hooks/useSnapshot'
import { OverviewPage } from '@/pages/OverviewPage'
import { LogsPage } from '@/pages/LogsPage'
import { CommandsPage } from '@/pages/CommandsPage'
import { ConsolePage } from '@/pages/ConsolePage'
import { StatsPage } from '@/pages/StatsPage'
import { BotPage } from '@/pages/BotPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { WarnsPage } from '@/pages/WarnsPage'
import { ModerationPage } from '@/pages/ModerationPage'
import { MembersPage } from '@/pages/MembersPage'
import { MaintenancePage } from '@/pages/MaintenancePage'
import { AccessRolePage } from '@/pages/AccessRolePage'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DashboardPresenceButton } from '@/components/DashboardPresenceButton'
import { useDashboardPresence } from '@/hooks/useDashboardPresence'
import { useDashboardGuilds } from '@/hooks/useDashboardGuilds'
import { CleanSelect } from '@/components/CleanSelect'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { useAuth } from '@/auth/AuthContext'

type Page =
  | 'overview'
  | 'logs'
  | 'commands'
  | 'console'
  | 'stats'
  | 'warns'
  | 'moderation'
  | 'members'
  | 'access'
  | 'bot'
  | 'profile'
  | 'maintenance'

const PAGE_PATHS: Record<Page, string> = {
  overview: '/',
  logs: '/logs',
  commands: '/commands',
  console: '/console',
  stats: '/stats',
  warns: '/warns',
  moderation: '/moderation',
  members: '/members',
  access: '/access',
  bot: '/bot',
  profile: '/profile',
  maintenance: '/maintenance',
}

const VALID_PATHNAMES = new Set<string>(Object.values(PAGE_PATHS))

function pathnameToPage(pathname: string): Page | null {
  const hit = (Object.entries(PAGE_PATHS) as [Page, string][]).find(([, p]) => p === pathname)
  return hit ? hit[0] : null
}

const NAV_MAIN: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard },
  { id: 'logs', label: 'Server-Protokolle', icon: ScrollText },
  { id: 'commands', label: 'Slash-Befehle', icon: Hash },
  { id: 'console', label: 'Live-Konsole', icon: Terminal },
  { id: 'warns', label: 'Verwarnungen', icon: AlertTriangle },
  { id: 'moderation', label: 'Moderation', icon: Gavel },
  { id: 'access', label: 'Dashboard-Zugriff', icon: Users },
  { id: 'members', label: 'Mitglieder', icon: Users },
  { id: 'stats', label: 'Mitglieder-Statistiken', icon: BarChart3 },
]

const NAV_SYSTEM: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'maintenance', label: 'Wartung', icon: Wrench },
  { id: 'profile', label: 'Bot-Profil', icon: UserRound },
  { id: 'bot', label: 'Steuerung', icon: Power },
]

export function DashboardShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { oauthOn, sessionOk, systemAccess, authLoading, loadAuth } = useAuth()

  const [maintenance, setMaintenance] = useState<{ enabled: boolean; text: string } | null>(null)
  const [refreshingRoles, setRefreshingRoles] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const lastRefreshAtRef = useRef(0)
  const lastReloadAllAtRef = useRef(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const pathPage = pathnameToPage(location.pathname)
  const page: Page = pathPage ?? 'overview'

  useEffect(() => {
    if (!VALID_PATHNAMES.has(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    if (systemAccess) return
    const sysPaths = [PAGE_PATHS.console, PAGE_PATHS.bot, PAGE_PATHS.profile, PAGE_PATHS.maintenance]
    if (sysPaths.includes(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [location.pathname, systemAccess, navigate])

  const [selectedGuildId, setSelectedGuildId] = useState('')
  const guildsEnabled = !authLoading && (!oauthOn || sessionOk === true)
  const { guilds, loadError: guildsLoadError, fetchAttempted: guildsFetchAttempted, reloadGuilds } =
    useDashboardGuilds(guildsEnabled)
  const { data, error, reload: reloadSnapshot } = useSnapshot(selectedGuildId)
  const { users: activeUsers, connected: presenceConnected } = useDashboardPresence(
    oauthOn && sessionOk === true && Boolean(selectedGuildId),
    selectedGuildId
  )

  useEffect(() => {
    if (page !== 'access') return
    if (!guildsFetchAttempted || guilds.length === 0) return
    const selectedGuild = guilds.find((g) => g.id === selectedGuildId)
    if (!selectedGuild?.isOwner) {
      navigate('/', { replace: true })
    }
  }, [page, guilds, selectedGuildId, guildsFetchAttempted, navigate])

  useEffect(() => {
    if (guilds.length === 0) return
    setSelectedGuildId((current) => {
      if (current && guilds.some((guild) => guild.id === current)) return current
      return guilds[0].id
    })
  }, [guilds])

  const serverScope: DashboardServerScope = useMemo(
    () => ({
      guildId: selectedGuildId,
      guildName: guilds.find((g) => g.id === selectedGuildId)?.name ?? data?.guild?.name ?? null,
      members: guilds.find((g) => g.id === selectedGuildId)?.members ?? data?.guild?.members ?? null,
      multiGuild: guilds.length > 1,
      guildsLoadError: guildsEnabled ? guildsLoadError : null,
      guildsLoadedEmpty:
        Boolean(guildsEnabled) && guildsFetchAttempted && !guildsLoadError && guilds.length === 0,
    }),
    [
      selectedGuildId,
      guilds,
      guildsLoadError,
      guildsFetchAttempted,
      guildsEnabled,
      data?.guild?.name,
      data?.guild?.members,
    ]
  )

  useEffect(() => {
    if (!oauthOn || sessionOk !== true) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void reloadGuilds()
      if (selectedGuildId) void reloadSnapshot()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [oauthOn, sessionOk, reloadGuilds, reloadSnapshot, selectedGuildId])

  const loadMaintenance = useCallback(async () => {
    if (!systemAccess) {
      setMaintenance(null)
      return
    }
    try {
      const r = await fetch(apiUrl('/api/system/maintenance'), { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        // Für Nicht-System-User sauber ignorieren statt 403-Spam in Folge-Requests.
        if (r.status === 401 || r.status === 403) {
          setMaintenance(null)
          return
        }
        return
      }
      setMaintenance({
        enabled: Boolean(j.enabled),
        text: typeof j.text === 'string' ? j.text : '',
      })
    } catch {
      // ignore
    }
  }, [systemAccess])

  useEffect(() => {
    if (!oauthOn || sessionOk !== true || !systemAccess) return
    void loadMaintenance()
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadMaintenance()
    }, 10000)
    return () => window.clearInterval(t)
  }, [oauthOn, sessionOk, systemAccess, loadMaintenance])

  useEffect(() => {
    if (!oauthOn || sessionOk !== true || !systemAccess) return
    let closed = false
    let retryTimer: number | null = null
    let retryDelay = 1000
    let stream: EventSource | null = null

    const clearRetry = () => {
      if (retryTimer != null) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (closed || retryTimer != null) return
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        connect()
      }, retryDelay)
      retryDelay = Math.min(retryDelay * 2, 10000)
    }

    const onMaintenance = (ev: Event) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as { enabled?: unknown; text?: unknown }
        setMaintenance({
          enabled: Boolean(payload?.enabled),
          text: typeof payload?.text === 'string' ? payload.text : '',
        })
      } catch {
        // ignore malformed events
      }
    }

    const connect = () => {
      if (closed) return
      try {
        stream?.close()
        stream = new EventSource(apiUrl('/api/maintenance-stream'), { withCredentials: true })
        stream.addEventListener('open', () => {
          retryDelay = 1000
          clearRetry()
        })
        stream.addEventListener('maintenance', onMaintenance)
        stream.addEventListener('error', () => {
          void loadMaintenance()
          scheduleReconnect()
        })
      } catch {
        scheduleReconnect()
      }
    }

    connect()
    const onOnline = () => {
      void loadMaintenance()
      scheduleReconnect()
    }
    window.addEventListener('online', onOnline)

    return () => {
      closed = true
      clearRetry()
      window.removeEventListener('online', onOnline)
      stream?.close()
    }
  }, [oauthOn, sessionOk, systemAccess, loadMaintenance])

  const reloadAll = async () => {
    const now = Date.now()
    if (refreshingAll) return
    if (now - lastReloadAllAtRef.current < 2000) return
    lastReloadAllAtRef.current = now
    setRefreshingAll(true)
    try {
      await Promise.all([loadAuth(), reloadGuilds(), reloadSnapshot()])
    } finally {
      setRefreshingAll(false)
    }
  }

  const refreshRolesAndReload = async () => {
    const now = Date.now()
    if (refreshingRoles) return
    if (now - lastRefreshAtRef.current < 2000) return
    lastRefreshAtRef.current = now
    setRefreshingRoles(true)
    try {
      await fetch(apiUrl('/api/access/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignorieren, danach normal neu laden
    }
    try {
      await reloadGuilds()
      await reloadSnapshot()
    } finally {
      setRefreshingRoles(false)
    }
  }

  const navBtn = (active: boolean) => (active ? 'dash-nav-item dash-nav-item-active' : 'dash-nav-item')
  const navIconWrap = (active: boolean) =>
    active ? 'dash-nav-icon-wrap dash-nav-icon-wrap-active' : 'dash-nav-icon-wrap'

  const effectivePage: Page =
    !systemAccess && (page === 'console' || page === 'bot' || page === 'profile' || page === 'maintenance')
      ? 'overview'
      : page === 'access' && !guilds.find((guild) => guild.id === selectedGuildId)?.isOwner
        ? 'overview'
        : page

  const navMainItems = useMemo(
    () =>
      NAV_MAIN.filter((item) => {
        if (!systemAccess && item.id === 'console') return false
        if (item.id === 'access') {
          const selectedGuild = guilds.find((guild) => guild.id === selectedGuildId)
          return Boolean(selectedGuild?.isOwner)
        }
        return true
      }),
    [systemAccess, guilds, selectedGuildId]
  )
  const navSystemItems = useMemo(() => (systemAccess ? NAV_SYSTEM : []), [systemAccess])

  const goToPage = (id: Page) => {
    navigate(PAGE_PATHS[id])
    setMobileNavOpen(false)
  }

  const accessCheckPending =
    authLoading || (oauthOn && sessionOk === true && guildsEnabled && !guildsFetchAttempted)

  if (accessCheckPending) {
    return (
      <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center bg-[var(--main-black)] px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/70 p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Zugriffe werden geprüft...</p>
        </div>
      </div>
    )
  }

  const noDashboardAccess =
    oauthOn &&
    sessionOk === true &&
    guildsEnabled &&
    guildsFetchAttempted &&
    (guilds.length === 0 || Boolean(guildsLoadError))

  if (noDashboardAccess) {
    return (
      <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center bg-[var(--main-black)] px-4 py-8">
        <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-6 text-red-100">
          <h1 className="text-2xl font-bold text-red-100">Zugriff verweigert</h1>
          <p className="mt-3 text-sm text-red-100/90">
            Du hast auf keinem Server Zugriff, auf dem der Bot läuft: du brauchst die vom Server-Owner
            gesetzte Dashboard-Zugriffsrolle (Discord-Administrator reicht nicht). Ohne Rolle nur der
            Server-Owner.
          </p>
          {guildsLoadError ? <p className="mt-2 text-sm text-red-200/90">{guildsLoadError}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="dash-btn px-4" onClick={() => void refreshRolesAndReload()}>
              {refreshingRoles ? 'Lade...' : 'Rollen neu laden'}
            </button>
            <a href={apiUrl('/api/auth/logout')} className="dash-btn dash-btn-danger px-4">
              Abmelden
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen flex-col bg-[var(--main-black)] md:grid md:h-screen md:grid-cols-[248px_1fr] md:overflow-hidden">
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/65 md:hidden"
          role="presentation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="dash-mobile-nav"
        className={`fixed inset-y-0 left-0 z-[100] flex w-[min(288px,88vw)] max-w-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)] shadow-[4px_0_32px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out md:static md:z-auto md:h-screen md:w-auto md:max-w-none md:translate-x-0 md:border-b-0 md:shadow-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-3 md:hidden">
          <div className="dash-sidebar-logo flex h-9 w-9 shrink-0 items-center justify-center p-1">
            <img src="/mynex-logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Mynex Dashboard</p>
            <p className="truncate text-xs text-zinc-500">Navigation</p>
          </div>
          <button
            type="button"
            className="dash-btn shrink-0 border-0 bg-transparent px-2"
            aria-label="Menü schließen"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-5 w-5 text-zinc-400" aria-hidden />
          </button>
        </div>

        <div className="dash-sidebar-brand hidden md:flex">
          <div className="dash-sidebar-logo">
            <img src="/mynex-logo.png" alt="Mynex" width={34} height={34} className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="dash-sidebar-title">Mynex</p>
            <p className="dash-sidebar-subtitle">Dashboard</p>
          </div>
          <Sparkles className="ml-auto h-4 w-4 text-[var(--accent)]/80" aria-hidden />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 md:min-h-0 md:gap-2 md:p-2.5 md:pt-3" aria-label="Hauptnavigation">
          <p className="dash-sidebar-section-label px-2.5 md:block">Navigation</p>
          <div className="flex flex-col gap-1 md:gap-1">
            {navMainItems.map((n) => {
              const Icon = n.icon
              const active = effectivePage === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => goToPage(n.id)}
                  className={`${navBtn(active)} w-full`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={navIconWrap(active)}>
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--accent)]' : 'text-zinc-500'}`} />
                  </span>
                  <span className="min-w-0 truncate">{n.label}</span>
                </button>
              )
            })}
          </div>
          {navSystemItems.length > 0 ? (
            <div className="mt-0 border-t border-[var(--border)] pt-1.5 md:mt-auto md:pt-2.5">
              <p className="dash-sidebar-section-label px-2.5 md:block">System</p>
              <div className="flex flex-col gap-1 md:space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/invite')
                    setMobileNavOpen(false)
                  }}
                  className={`${navBtn(false)} w-full`}
                >
                  <span className={navIconWrap(false)}>
                    <UserPlus className="h-4 w-4 shrink-0 text-zinc-500" />
                  </span>
                  <span className="min-w-0 truncate">Bot einladen</span>
                </button>
                {navSystemItems.map((n) => {
                  const Icon = n.icon
                  const active = effectivePage === n.id
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => goToPage(n.id)}
                      className={`${navBtn(active)} w-full`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className={navIconWrap(active)}>
                        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--accent)]' : 'text-zinc-500'}`} />
                      </span>
                      <span className="min-w-0 truncate">{n.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </nav>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--main-black)] md:h-screen md:overflow-hidden">
        <header className="dash-mobile-toolbar border-b border-[var(--border)] px-3 py-3 sm:px-6">
          <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-2">
            <button
              type="button"
              className="dash-btn self-start md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="dash-mobile-nav"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <Menu className="h-5 w-5 text-zinc-300" aria-hidden />
              <span className="sr-only">Menü öffnen</span>
            </button>
            {guilds.length > 0 && (!oauthOn || sessionOk === true) ? (
              <div className="order-1 w-full min-w-0 md:order-2 md:w-[min(280px,100%)]">
                <CleanSelect
                  value={selectedGuildId}
                  onChange={setSelectedGuildId}
                  flatOptions={guilds.map((guild) => ({
                    value: guild.id,
                    label:
                      guild.botPresent === false
                        ? `${guild.name} — Bot nicht auf diesem Server`
                        : `${guild.name} (${guild.members ?? '—'})`,
                  }))}
                  placeholder="Server wählen"
                  className="w-full"
                />
              </div>
            ) : null}
            {oauthOn && sessionOk === true ? (
              <div className="order-2 min-w-0 md:order-1">
                <DashboardPresenceButton users={activeUsers} connected={presenceConnected} />
              </div>
            ) : null}
            <ThemeToggle className="order-3 flex-1 md:order-3 md:flex-none" />
            <button
              type="button"
              className="dash-btn order-4 flex-1 px-3 md:order-4 md:flex-none"
              onClick={() => void reloadAll()}
              disabled={refreshingAll}
            >
              {refreshingAll ? 'Lade…' : 'Aktualisieren'}
            </button>
            {oauthOn && sessionOk === true ? (
              <button
                type="button"
                className="dash-btn order-4 flex-1 px-3 md:order-4 md:flex-none"
                onClick={() => void refreshRolesAndReload()}
                disabled={refreshingRoles}
              >
                {refreshingRoles ? 'Lade...' : 'Rollen neu laden'}
              </button>
            ) : null}
            {sessionOk === true ? (
              <a
                href={apiUrl('/api/auth/logout')}
                className="dash-btn dash-btn-danger order-5 flex-1 px-3 md:order-5 md:flex-none"
              >
                Abmelden
              </a>
            ) : null}
          </div>
        </header>
        {maintenance?.enabled ? (
          <div className="border-b border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-100 sm:px-6">
            <span className="font-semibold">Wartungsarbeiten:</span>{' '}
            {maintenance.text || 'Dashboard wird aktuell gewartet.'}
          </div>
        ) : null}
        <main className="dash-main-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[var(--main-black)] px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          {effectivePage === 'overview' && <OverviewPage data={data} error={error} serverScope={serverScope} />}
          {effectivePage === 'logs' && <LogsPage data={data} selectedGuildId={selectedGuildId} serverScope={serverScope} />}
          {effectivePage === 'commands' && (
            <CommandsPage data={data} serverScope={serverScope} selectedGuildId={selectedGuildId} />
          )}
          {effectivePage === 'console' && systemAccess && <ConsolePage selectedGuildId={selectedGuildId} />}
          {effectivePage === 'stats' && <StatsPage selectedGuildId={selectedGuildId} serverScope={serverScope} />}
          {effectivePage === 'warns' && <WarnsPage selectedGuildId={selectedGuildId} serverScope={serverScope} />}
          {effectivePage === 'moderation' && <ModerationPage selectedGuildId={selectedGuildId} serverScope={serverScope} />}
          {effectivePage === 'members' && <MembersPage selectedGuildId={selectedGuildId} serverScope={serverScope} />}
          {effectivePage === 'access' && <AccessRolePage selectedGuildId={selectedGuildId} />}
          {effectivePage === 'bot' && systemAccess && <BotPage data={data} />}
          {effectivePage === 'profile' && systemAccess && <ProfilePage data={data} />}
          {effectivePage === 'maintenance' && systemAccess && (
            <MaintenancePage
              current={maintenance}
              onChanged={(next) => setMaintenance(next)}
            />
          )}
        </main>
        <footer className="border-t border-[var(--border)] bg-[var(--sidebar)]/80 px-4 py-3 text-xs text-[var(--muted)] sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>DSGVO-Löschanfragen: Support@mynexstudios.com (kein allgemeiner Self-Service-Endpunkt).</p>
            <div className="flex items-center gap-3">
              <Link className="underline hover:no-underline" to="/datenschutz">
                Datenschutz
              </Link>
              <Link className="underline hover:no-underline" to="/impressum">
                Impressum
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
