import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { Gavel } from 'lucide-react'
import { ModerationConfirmModal } from '@/components/ModerationConfirmModal'
import { ModerationActionBar } from '@/components/ModerationActionBar'
import { ModerationResultList } from '@/components/ModerationResultList'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'

type LookupRow =
  | { kind: 'member'; id: string; tag: string; displayName: string; avatarUrl: string }
  | { kind: 'banned'; id: string; tag: string; avatarUrl: string }

type ModAction = 'kick' | 'ban' | 'unban' | 'mute' | 'unmute'

type Flash = { kind: 'ok' | 'err'; text: string }

type Pending = { action: ModAction; target: LookupRow }

export function ModerationPage({
  selectedGuildId,
  serverScope,
}: {
  selectedGuildId: string
  serverScope: DashboardServerScope
}) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LookupRow[]>([])
  const [selected, setSelected] = useState<LookupRow | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reason, setReason] = useState('')
  const [muteMinutes, setMuteMinutes] = useState(10)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setQuery('')
    setResults([])
    setSelected(null)
    setFlash(null)
    setPending(null)
    setReason('')
  }, [selectedGuildId])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 8000)
    return () => clearTimeout(t)
  }, [flash])

  const search = useCallback(async () => {
    if (!selectedGuildId) return
    const q = query.trim()
    if (q.length < 2 && !/^\d{17,22}$/.test(q)) {
      setFlash({ kind: 'err', text: 'Mindestens 2 Zeichen oder eine gültige User-ID eingeben.' })
      return
    }
    setLoading(true)
    setFlash(null)
    setSelected(null)
    try {
      const r = await fetch(
        apiUrl(
          `/api/moderation/member?guildId=${encodeURIComponent(selectedGuildId)}&q=${encodeURIComponent(q)}`
        ),
        { credentials: 'include' }
      )
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Suche fehlgeschlagen')
      const list = Array.isArray(j.results) ? j.results : []
      setResults(list as LookupRow[])
      if (list.length === 1) setSelected(list[0] as LookupRow)
    } catch (e) {
      setResults([])
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler' })
    } finally {
      setLoading(false)
    }
  }, [query, selectedGuildId])

  const runAction = async () => {
    if (!pending || !selectedGuildId) return
    const { action, target } = pending
    if (action === 'ban' && !reason.trim()) {
      setFlash({ kind: 'err', text: 'Bei Ban ist ein Grund Pflicht.' })
      return
    }
    setSubmitting(true)
    setFlash(null)
    try {
      const body: Record<string, unknown> = {
        action,
        guildId: selectedGuildId,
        targetUserId: target.id,
        reason: reason.trim(),
      }
      if (action === 'mute') body.muteMinutes = muteMinutes
      const r = await fetch(apiUrl('/api/moderation'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 429) {
        const sec = typeof j.retryAfter === 'number' ? j.retryAfter : null
        throw new Error(sec != null ? `${j.error || 'Zu viele Anfragen.'} (${sec}s)` : j.error || 'Rate limit')
      }
      if (!r.ok) throw new Error(j.error || 'Aktion fehlgeschlagen')
      setPending(null)
      setFlash({ kind: 'ok', text: j.message || 'Erfolgreich.' })
      setSelected(null)
      setResults([])
      setQuery('')
    } catch (e) {
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler' })
    } finally {
      setSubmitting(false)
    }
  }

  const openConfirm = useCallback((action: ModAction, target: LookupRow) => {
    setReason('')
    setMuteMinutes(10)
    setPending({ action, target })
  }, [])

  if (!selectedGuildId) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <p className="dash-page-desc">Bitte oben einen Server wählen.</p>
      </div>
    )
  }

  return (
    <div className="dash-page-shell">
      <ServerScopeBanner scope={serverScope} />
      <header>
        <h1 className="dash-page-title flex items-center gap-2">
          <Gavel className="h-7 w-7 text-amber-500/90" aria-hidden />
          Moderation
        </h1>
        <p className="dash-page-desc">
          Nutzername oder User-ID suchen — bei gebannten Nutzern reicht die ID. Entspricht{' '}
          <span className="font-mono text-[var(--accent)]">/kick</span>,{' '}
          <span className="font-mono text-[var(--accent)]">/ban</span>,{' '}
          <span className="font-mono text-[var(--accent)]">/unban</span>,{' '}
          <span className="font-mono text-[var(--accent)]">/mute</span>,{' '}
          <span className="font-mono text-[var(--accent)]">/unmute</span>.
        </p>
      </header>

      {flash ? (
        <div
          className={`dash-panel mb-4 px-4 py-3 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/35 bg-red-500/10 text-red-200'
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="dash-panel mb-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="dash-label">Suche</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name oder User-ID"
            className="dash-input mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
        </label>
        <button
          type="button"
          className="dash-btn px-4 py-2 text-sm font-medium"
          disabled={loading}
          onClick={() => void search()}
        >
          {loading ? '…' : 'Suchen'}
        </button>
      </div>

      <ModerationResultList results={results} selected={selected} onSelect={setSelected} />

      {selected ? <ModerationActionBar selected={selected} onAction={openConfirm} /> : null}

      {pending ? (
        <ModerationConfirmModal
          pending={pending}
          reason={reason}
          muteMinutes={muteMinutes}
          submitting={submitting}
          onReasonChange={setReason}
          onMuteMinutesChange={setMuteMinutes}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}
