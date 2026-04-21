import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { Link } from 'react-router-dom'
import { ExternalLink, Loader2 } from 'lucide-react'

/**
 * Oeffentliche Invite-Seite (kein Login). URL vom Server: GET /api/invite-link
 */
export function InvitePage() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(apiUrl('/api/invite-link'))
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
        if (cancelled) return
        if (!r.ok) {
          setError(typeof j.error === 'string' ? j.error : 'Invite-Link konnte nicht geladen werden.')
          return
        }
        if (typeof j.url === 'string' && j.url.startsWith('https://discord.com/oauth2/authorize')) {
          setInviteUrl(j.url)
        } else {
          setError('Ungültige Antwort vom Server.')
        }
      } catch {
        if (!cancelled) setError('Netzwerkfehler beim Laden des Invite-Links.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative min-h-[100dvh] min-h-screen bg-[var(--main-black)] px-4 py-12 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] p-2 shadow-lg">
          <img src="/mynex-logo.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Mynex auf deinen Server holen</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-[15px]">
          Mynex ist dein Discord-Bot für Moderation, durchsuchbare Server-Logs und Verwarnungen. Über das Web-Dashboard
          steuerst du alles zentral — inklusive eigener Befehle im visuellen Flow-Editor, ohne Code schreiben zu müssen.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-[15px]">
          Nach dem Einladen richtest du Berechtigungen und Dashboard-Zugriff für dein Team bequem auf dem Server ein.
        </p>

        <div className="mt-8 w-full space-y-4">
          <figure className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] shadow-lg">
            <img
              src="/showcase-01.png"
              alt="Mynex Vorschau mit Hero-Bereich"
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </figure>
          <figure className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] shadow-lg">
            <img
              src="/showcase-02.png"
              alt="Mynex Dashboard Übersicht"
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </figure>
        </div>

        <div className="mt-10 w-full">
          {error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {!error && !inviteUrl ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden />
              <span className="sr-only">Lade Einladungslink…</span>
            </div>
          ) : null}
          {inviteUrl ? (
            <a
              href={inviteUrl}
              rel="noopener noreferrer"
              className="dash-btn dash-btn-accent inline-flex w-full min-h-[52px] justify-center gap-2 rounded-xl border px-6 py-3 text-base font-semibold shadow-[0_0_0_1px_rgba(139,144,232,0.15)]"
            >
              Bot einladen
              <ExternalLink className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            </a>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          Du wirst zu Discord weitergeleitet. Der Bot benötigt die gewählten Berechtigungen und den Scope für
          Anwendungsbefehle.
        </p>

        <Link
          to="/"
          className="mt-10 text-sm text-[var(--muted)] underline decoration-zinc-600 underline-offset-4 hover:text-zinc-300"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  )
}
