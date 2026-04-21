import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { AlertTriangle } from 'lucide-react'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'

type WarnRow = {
  ts: number
  guildId: string
  guildName: string | null
  targetId: string
  targetTag: string
  moderatorId: string
  moderatorTag: string
  reason: string | null
}

export function WarnsPage({
  selectedGuildId,
  serverScope,
}: {
  selectedGuildId: string
  serverScope: DashboardServerScope
}) {
  const [rows, setRows] = useState<WarnRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedGuildId) {
      setRows([])
      setErr(null)
      return
    }
    setRows([])
    setErr(null)
    let cancelled = false
    async function load() {
      try {
        const query = `?guildId=${encodeURIComponent(selectedGuildId)}`
        const r = await fetch(apiUrl(`/api/warnings${query}`), { credentials: 'include' })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
        if (!cancelled) {
          setRows(Array.isArray(j.warnings) ? j.warnings : [])
          setErr(null)
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Fehler')
      }
    }
    void load()
    const t = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [selectedGuildId])

  if (!selectedGuildId) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <p className="dash-page-desc">Server wird geladen…</p>
      </div>
    )
  }

  if (err) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <div className="dash-panel border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>
      </div>
    )
  }

  return (
    <div className="dash-page-shell">
      <ServerScopeBanner scope={serverScope} />
      <header>
        <h1 className="dash-page-title flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-amber-400/90" aria-hidden />
          Verwarnungen
        </h1>
        <p className="dash-page-desc">
          Einträge aus <code className="dash-code">/warn</code> · Verwaltung via <code className="dash-code">/warns</code>,{' '}
          <code className="dash-code">/unwarn</code>, <code className="dash-code">/clearwarns</code> · gespeichert in{' '}
          <code className="dash-code">data/warns/&lt;guildId&gt;.json</code>
        </p>
      </header>

      <div className="dash-panel">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <span className="dash-label">Einträge</span>
          <span className="dash-hint tabular-nums">{rows.length}</span>
        </div>
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-[var(--muted)] sm:px-5">
              Noch keine Verwarnungen — nutze den Slash-Befehl <span className="font-mono text-[var(--accent)]">/warn</span>.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((w, i) => (
                <li key={`${w.ts}-${w.targetId}-${i}`} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                    <time className="tabular-nums">
                      {new Date(w.ts).toLocaleString('de-DE', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </time>
                    {w.guildName ? (
                      <span className="rounded border border-[var(--border)] bg-black/20 px-1.5 py-0.5 text-[var(--muted)]">
                        {w.guildName}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--foreground)]/90">
                    <span className="font-medium text-[var(--foreground)]">{w.targetTag}</span>
                    <span className="mx-1 font-mono text-xs text-[var(--muted)]">{w.targetId}</span>
                  </p>
                  <p className="dash-hint mt-1">
                    Von <span className="text-[var(--foreground)]/75">{w.moderatorTag}</span>
                    {w.reason ? (
                      <>
                        {' '}
                        · <span className="text-[var(--foreground)]/85">{w.reason}</span>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
