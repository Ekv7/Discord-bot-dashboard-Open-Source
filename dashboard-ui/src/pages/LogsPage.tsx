import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import type { Snapshot } from '@/hooks/useSnapshot'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'
import { CleanSelect } from '@/components/CleanSelect'
import { LogEntryRow } from '@/components/LogEntryRow'
import {
  TYPE_FILTERS,
  TYPE_LABELS,
  filterServerLogs,
  uniqueChannelsFromLogs,
  type TypeFilter,
} from '@/pages/logs/logsFiltering'

type GuildRole = { id: string; name: string; color: string | null }

export function LogsPage({
  data,
  selectedGuildId,
  serverScope,
}: {
  data: Snapshot | null
  selectedGuildId: string
  serverScope: DashboardServerScope
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [executorRoleId, setExecutorRoleId] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [sortNewestFirst, setSortNewestFirst] = useState(true)
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([])
  const [rolesErr, setRolesErr] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    if (!selectedGuildId) {
      setGuildRoles([])
      setRolesErr(null)
      return
    }
    try {
      const query = `?guildId=${encodeURIComponent(selectedGuildId)}`
      const r = await fetch(apiUrl(`/api/guild-roles${query}`), { credentials: 'include' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Rollen laden fehlgeschlagen')
      setGuildRoles(Array.isArray(j.roles) ? j.roles : [])
      setRolesErr(null)
    } catch (e) {
      setRolesErr(e instanceof Error ? e.message : 'Rollen API')
      setGuildRoles([])
    }
  }, [selectedGuildId])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    setExecutorRoleId('all')
    setChannelFilter('all')
    setQ('')
  }, [selectedGuildId])

  const channelOptions = useMemo(
    () => (data ? uniqueChannelsFromLogs(data.serverLogs) : []),
    [data]
  )

  const rows = useMemo(() => {
    if (!data) return []
    return filterServerLogs(data.serverLogs, {
      typeFilter,
      executorRoleId,
      channelFilter,
      q,
      sortNewestFirst,
    })
  }, [data, typeFilter, executorRoleId, channelFilter, q, sortNewestFirst])

  const executorRoleGroups = useMemo(
    () =>
      guildRoles.length > 0
        ? [{ label: 'Executor-Rolle (Audit & Kick)', options: guildRoles.map((r) => ({ value: r.id, label: r.name })) }]
        : [],
    [guildRoles]
  )

  const channelFlatOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Alle Kanäle' }]
    return base.concat(channelOptions.map((c) => ({ value: c, label: c })))
  }, [channelOptions])

  if (!data) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <p className="text-sm text-[var(--muted)]">Lade Protokolle…</p>
      </div>
    )
  }

  return (
    <div className="dash-page-shell">
      <ServerScopeBanner scope={serverScope} />
      <header>
        <h1 className="dash-page-title">Server-Protokolle</h1>
        <p className="dash-page-desc">
          Filter und Suche gelten für die Snapshot-Liste. <strong>Moderation</strong> bündelt alle Slash-Mods;{' '}
          <strong>Verwarnung</strong> zeigt <span className="font-mono text-[var(--accent)]">/warn</span>,{' '}
          <span className="font-mono text-[var(--accent)]">/unwarn</span> und{' '}
          <span className="font-mono text-[var(--accent)]">/clearwarns</span>.{' '}
          <strong>Chat leeren</strong> zeigt <span className="font-mono text-[var(--accent)]">/clearchat</span>.
        </p>
      </header>

      {rolesErr ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200/90">
          {rolesErr}
        </p>
      ) : null}

      <section className="dash-panel-popover relative z-10 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3">
          <div className="flex flex-col gap-1.5 lg:col-span-4">
            <label className="dash-label" htmlFor="logs-search">
              Suche
            </label>
            <input
              id="logs-search"
              className="dash-input w-full"
              placeholder="Name, User-ID, Kanal, Aktion…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 lg:col-span-3">
            <label className="dash-label" id="logs-channel-label">
              Kanal
            </label>
            <CleanSelect
              value={channelFilter}
              flatOptions={channelFlatOptions}
              onChange={(v) => setChannelFilter(v)}
              labelId="logs-channel-label"
            />
          </div>
          <div className="flex flex-col gap-1.5 lg:col-span-3">
            <label className="dash-label" id="logs-executor-label">
              Executor-Rolle (Audit &amp; Kick)
            </label>
            <CleanSelect
              value={executorRoleId}
              flatOptions={[{ value: 'all', label: 'Alle Einträge' }]}
              groups={executorRoleGroups.length > 0 ? executorRoleGroups : undefined}
              onChange={(v) => setExecutorRoleId(v)}
              labelId="logs-executor-label"
            />
          </div>
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="dash-label">Reihenfolge</label>
            <div className="dash-segment">
              <button
                type="button"
                onClick={() => setSortNewestFirst(true)}
                className={`dash-segment-btn ${sortNewestFirst ? 'dash-segment-btn-active' : ''}`}
              >
                Neu → alt
              </button>
              <button
                type="button"
                onClick={() => setSortNewestFirst(false)}
                className={`dash-segment-btn ${!sortNewestFirst ? 'dash-segment-btn-active' : ''}`}
              >
                Alt → neu
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="dash-label mb-2">Ereignistyp</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`dash-filter-chip ${typeFilter === f ? 'dash-filter-chip-active' : ''}`}
              >
                {TYPE_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="dash-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <span className="dash-label">Einträge (gefiltert)</span>
          <span className="dash-hint tabular-nums">{rows.length}</span>
        </div>
        <div className="max-h-[min(70vh,680px)] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-[var(--muted)] sm:px-5">
              {data.serverLogs.length === 0
                ? 'Noch keine Server-Logs — der Bot braucht u. a. „Audit-Log anzeigen“ für Kicks und passende Intents.'
                : 'Keine Treffer für diese Filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((l, i) => (
                <LogEntryRow key={`${l.ts}-${l.userId ?? l.user}-${i}`} l={l} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
