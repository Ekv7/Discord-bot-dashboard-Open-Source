import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

type Line = { ts: number; level: string; text: string }

export function ConsolePage({ selectedGuildId }: { selectedGuildId: string }) {
  const [lines, setLines] = useState<Line[]>([])
  const [auto, setAuto] = useState(true)
  const [snapshotErr, setSnapshotErr] = useState<string | null>(null)
  const [streamState, setStreamState] = useState<'connecting' | 'open' | 'error'>('connecting')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedGuildId) {
      const resetId = window.setTimeout(() => {
        setLines([])
        setSnapshotErr(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }
    let cancelled = false
    async function loadSnapshot() {
      try {
        setSnapshotErr(null)
        const r = await fetch(apiUrl(`/api/snapshot?guildId=${encodeURIComponent(selectedGuildId)}`), {
          credentials: 'include',
        })
        const j = (await r.json().catch(() => ({}))) as { consoleLines?: unknown; error?: string }
        if (cancelled) return
        if (!r.ok) {
          setSnapshotErr(typeof j.error === 'string' ? j.error : `Snapshot ${r.status}`)
          return
        }
        if (Array.isArray(j.consoleLines)) setLines(j.consoleLines as Line[])
      } catch {
        if (!cancelled) setSnapshotErr('Konsole konnte nicht geladen werden.')
      }
    }
    void loadSnapshot()
    return () => {
      cancelled = true
    }
  }, [selectedGuildId])

  useEffect(() => {
    const es = new EventSource(apiUrl('/api/stream'), { withCredentials: true })
    es.addEventListener('open', () => setStreamState('open'))
    es.addEventListener('error', () => setStreamState('error'))
    es.addEventListener('console', (ev) => {
      try {
        const line = JSON.parse((ev as MessageEvent).data) as Line
        setLines((prev) => {
          const next = [...prev, line]
          return next.length > 500 ? next.slice(-500) : next
        })
      } catch {
        /* ignore */
      }
    })
    return () => es.close()
  }, [])

  useEffect(() => {
    if (auto && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, auto])

  const cls = (level: string) => {
    if (level === 'error') return 'text-red-400/95'
    if (level === 'warn') return 'text-amber-300/90'
    return 'text-zinc-400'
  }

  return (
    <div className="dash-page-shell">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="dash-page-title">Konsole</h1>
          <p className="dash-page-desc">
            Ausgabe von <code className="dash-code">console.log</code> / warn / error des Bot-Prozesses — gilt für{' '}
            <strong>alle</strong> Server (ein Prozess). Live-Updates per Stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dash-btn" onClick={() => setLines([])}>
            Leeren
          </button>
          <button
            type="button"
            className={`dash-btn ${auto ? 'dash-btn-accent' : ''}`}
            onClick={() => setAuto((a) => !a)}
          >
            Auto-Scroll {auto ? 'an' : 'aus'}
          </button>
        </div>
      </header>

      {!selectedGuildId ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/90">
          Bitte oben einen Server wählen — dann wird der Konsole-Puffer aus dem Snapshot geladen.
        </p>
      ) : null}

      {snapshotErr ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          {snapshotErr}
        </p>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        Live-Stream:{' '}
        {streamState === 'open'
          ? 'verbunden'
          : streamState === 'connecting'
            ? 'verbindet…'
            : 'getrennt — Seite neu laden oder Anmeldung prüfen'}
      </p>

      <div className="dash-panel max-h-[min(58vh,560px)] overflow-auto p-4 font-mono text-xs leading-relaxed sm:p-5">
        {lines.length === 0 && selectedGuildId && !snapshotErr ? (
          <p className="text-sm text-zinc-600">
            Warte auf Ausgabe… (bei Ruhe keine neuen Zeilen — Stream ist aktiv, sobald der Bot etwas loggt.)
          </p>
        ) : null}
        {lines.map((l, i) => (
          <div key={`${l.ts}-${i}`} className={cls(l.level)}>
            <span className="text-zinc-600">[{new Date(l.ts).toLocaleTimeString('de-DE')}]</span> {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
