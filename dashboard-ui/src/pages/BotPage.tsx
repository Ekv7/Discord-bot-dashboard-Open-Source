import { useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { Power, RefreshCw, AlertTriangle } from 'lucide-react'
import type { Snapshot } from '@/hooks/useSnapshot'

export function BotPage({ data }: { data: Snapshot | null }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showLoginLink, setShowLoginLink] = useState(false)

  async function callControl(action: 'stop' | 'restart') {
    setMsg(null)

    const ok = window.confirm(
      action === 'stop'
        ? 'Bot wirklich stoppen? Das Dashboard ist danach offline, bis du den Prozess neu startest (z. B. npm start).'
        : 'Bot wirklich neu starten? Kurze Unterbrechung (ca. 1 s), dann läuft wieder alles.'
    )
    if (!ok) return

    setBusy(action)
    setShowLoginLink(false)
    try {
      const r = await fetch(apiUrl('/api/bot/control'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) {
        setShowLoginLink(true)
        setMsg('Nicht angemeldet — für Stop/Neustart brauchst du eine gültige Discord-Session.')
        return
      }
      if (r.status === 429) {
        const sec = typeof j.retryAfter === 'number' ? j.retryAfter : null
        setMsg(
          sec != null
            ? `${j.error || 'Zu viele Anfragen.'} (${sec}s warten)`
            : j.error || 'Zu viele Anfragen — kurz warten.'
        )
        return
      }
      if (!r.ok) {
        setMsg(j.error || `Fehler ${r.status}`)
        return
      }
      setMsg(action === 'restart' ? 'Neustart läuft… Seite gleich neu laden.' : 'Bot wird beendet…')
      if (action === 'restart') {
        setTimeout(() => window.location.reload(), 2500)
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Netzwerkfehler')
    } finally {
      setBusy(null)
    }
  }

  const online = data?.bot?.ready && data?.bot?.tag

  const presenceDe: Record<string, string> = {
    online: 'Online',
    idle: 'Abwesend',
    dnd: 'Bitte nicht stören',
    invisible: 'Unsichtbar',
    offline: 'Offline',
  }

  return (
    <div className="dash-page-shell-xs">
      <div>
        <h1 className="dash-page-title">Bot steuern</h1>
        <p className="dash-page-desc">
          Nach Discord-Login mit der erlaubten Rolle sind Stoppen und Neustart ohne extra Passwort möglich (Session-Cookie).
        </p>
      </div>

      <div className="dash-panel p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Status</p>
        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
          {online ? (
            <span className="text-emerald-400">Online · {data?.bot?.tag}</span>
          ) : (
            <span className="text-[var(--muted)]">Nicht verbunden / lädt…</span>
          )}
        </p>
        {online && data?.bot && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Discord-Status:{' '}
            <span className="font-medium text-[var(--foreground)]/90">
              {presenceDe[data.bot.status] ?? data.bot.status}
            </span>
            {data.bot.activity?.name ? (
              <span>
                {' '}
                · {data.bot.activity.name}
                {data.bot.activity.state ? (
                  <span className="opacity-80"> — {data.bot.activity.state}</span>
                ) : null}
              </span>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={Boolean(busy) || !online}
          onClick={() => callControl('restart')}
          className="dash-btn dash-btn-accent flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          <RefreshCw className={`h-4 w-4 ${busy === 'restart' ? 'animate-spin' : ''}`} />
          Neu starten
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || !online}
          onClick={() => callControl('stop')}
          className="dash-btn dash-btn-danger flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          <Power className="h-4 w-4" />
          Stoppen
        </button>
      </div>

      {msg && (
        <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
          <p>{msg}</p>
          {showLoginLink ? (
            <a href={apiUrl('/api/auth/discord')} className="inline-flex dash-btn dash-btn-accent text-sm font-semibold">
              Mit Discord anmelden
            </a>
          ) : null}
        </div>
      )}

      <div className="dash-panel flex gap-3 border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100/90">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-2">
          <p>
            <strong className="text-amber-200">Stoppen</strong> beendet den ganzen Node-Prozess (Bot + Dashboard). Zum
            Wiederanlaufen in der Konsole <code className="dash-code">npm start</code> ausführen.
          </p>
          <p>
            <strong className="text-amber-200">Neu starten</strong> startet eine neue Instanz und beendet die aktuelle
            — danach die Seite kurz neu laden.
          </p>
        </div>
      </div>
    </div>
  )
}
