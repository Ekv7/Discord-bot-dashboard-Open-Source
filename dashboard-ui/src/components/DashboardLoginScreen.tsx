import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiUrl } from '@/lib/apiBase'

type DashboardLoginScreenProps = {
  authLoading: boolean
  onReload: () => void
  /** OAuth-Start inkl. ?next=… für Rücksprung nach Login */
  discordHref?: string
}

export function DashboardLoginScreen({
  authLoading,
  onReload,
  discordHref = apiUrl('/api/auth/discord'),
}: DashboardLoginScreenProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(apiUrl('/api/invite-link'))
        const j = (await r.json().catch(() => ({}))) as { url?: string }
        if (cancelled) return
        if (r.ok && typeof j.url === 'string' && j.url.startsWith('https://discord.com/oauth2/authorize')) {
          setInviteUrl(j.url)
        }
      } catch {
        /* still: Login bleibt nutzbar */
      } finally {
        if (!cancelled) setInviteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_36%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.05),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(0,0,0,0.45),transparent_52%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0f]/95 p-7 shadow-[0_28px_80px_rgba(0,0,0,0.7)] backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 p-1.5">
            <img src="/mynex-logo.png" alt="Mynex" width={40} height={40} className="h-9 w-9 object-contain" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">Mynex Dashboard</p>
            <p className="text-xs text-white/70">Discord Auth erforderlich</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">Mynex auf deinen Server holen</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/65">
            Das Dashboard zeigt nur Server, auf denen der Bot bereits Mitglied ist — lade Mynex zuerst per Discord ein,
            melde dich danach an.
          </p>
          <div className="mt-3">
            {inviteLoading ? (
              <div className="flex min-h-[44px] items-center justify-center gap-2 text-xs text-white/55">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Einladungslink wird geladen…
              </div>
            ) : inviteUrl ? (
              <a
                href={inviteUrl}
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-white/35 hover:bg-white/[0.1]"
              >
                Bot einladen
                <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </a>
            ) : (
              <p className="text-center text-[11px] text-white/50">Einladungslink derzeit nicht verfügbar (Bot-ID fehlt).</p>
            )}
          </div>
        </div>

        <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-white/45">Bereits eingeladen?</p>

        <div className="space-y-3">
          <a
            href={discordHref}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.1] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-white/35 hover:bg-white/[0.16]"
          >
            Mit Discord anmelden
          </a>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
            onClick={onReload}
            disabled={authLoading}
          >
            {authLoading ? 'Prüfe...' : 'Rollen aktualisieren'}
          </button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-white/65">
          Hinweis: Zugriff nur für berechtigte Teammitglieder. Beim Login werden Discord-Kontodaten
          (z. B. Nutzername, ID, Avatar) sowie sicherheitsrelevante Dashboard-Aktivitäten verarbeitet,
          um Zugriff, Moderation und Systembetrieb zu ermöglichen.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/70">
          <span>DSGVO-Löschanfragen: Support@mynexstudios.com</span>
          <Link className="underline hover:no-underline" to="/datenschutz">
            Datenschutz
          </Link>
          <Link className="underline hover:no-underline" to="/impressum">
            Impressum
          </Link>
        </div>
      </div>
    </div>
  )
}
