import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { Users } from 'lucide-react'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'
import { MemberBrowseCard, type MemberBrowseRow } from '@/components/MemberBrowseCard'

type ApiResponse = {
  members: MemberBrowseRow[]
  nextAfter: string | null
  hasMore: boolean
  searchMode: boolean
  page?: number
  totalMembers?: number | null
  listMode?: 'sorted' | 'api'
  listModeHint?: string | null
  error?: string
}

export function MembersPage({
  selectedGuildId,
  serverScope,
}: {
  selectedGuildId: string
  serverScope: DashboardServerScope
}) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [rows, setRows] = useState<MemberBrowseRow[]>([])
  const [nextAfter, setNextAfter] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [listMode, setListMode] = useState<'sorted' | 'api'>('sorted')
  const [listModeHint, setListModeHint] = useState<string | null>(null)
  const [totalMembers, setTotalMembers] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!selectedGuildId) return
    let cancelled = false
    async function run() {
      setLoading(true)
      setErr(null)
      setRows([])
      setNextAfter(null)
      setPage(0)
      setListModeHint(null)
      setTotalMembers(null)
      setHasMore(false)
      try {
        const params = new URLSearchParams({ guildId: selectedGuildId, limit: '40' })
        if (debouncedQ.length >= 2) params.set('q', debouncedQ)
        const r = await fetch(apiUrl(`/api/guild-members?${params}`), { credentials: 'include' })
        const j = (await r.json()) as ApiResponse
        if (cancelled) return
        if (!r.ok) {
          setErr(typeof j.error === 'string' ? j.error : `Fehler ${r.status}`)
          return
        }
        const list = Array.isArray(j.members) ? j.members : []
        setRows(list)
        setNextAfter(j.nextAfter ?? null)
        setPage(typeof j.page === 'number' ? j.page : 0)
        setListMode(j.listMode === 'api' ? 'api' : 'sorted')
        setListModeHint(typeof j.listModeHint === 'string' ? j.listModeHint : null)
        setTotalMembers(typeof j.totalMembers === 'number' ? j.totalMembers : null)
        setHasMore(Boolean(j.hasMore))
        setSearchMode(Boolean(j.searchMode))
      } catch {
        if (!cancelled) {
          setErr('Netzwerkfehler.')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedGuildId, debouncedQ])

  async function loadMore() {
    if (!hasMore || loading || searchMode || debouncedQ.length >= 2 || !selectedGuildId) return
    if (listMode === 'api' && !nextAfter) return
    setLoading(true)
    setErr(null)
    try {
      const params = new URLSearchParams({ guildId: selectedGuildId, limit: '40' })
      if (listMode === 'api' && nextAfter) {
        params.set('after', nextAfter)
      } else {
        params.set('page', String(page + 1))
      }
      const r = await fetch(apiUrl(`/api/guild-members?${params}`), { credentials: 'include' })
      const j = (await r.json()) as ApiResponse
      if (!r.ok) {
        setErr(typeof j.error === 'string' ? j.error : `Fehler ${r.status}`)
        return
      }
      const list = Array.isArray(j.members) ? j.members : []
      setRows((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        const add = list.filter((x) => !seen.has(x.id))
        return [...prev, ...add]
      })
      setNextAfter(j.nextAfter ?? null)
      if (typeof j.page === 'number') setPage(j.page)
      else if (listMode !== 'api') setPage((p) => p + 1)
      setHasMore(Boolean(j.hasMore))
    } catch {
      setErr('Netzwerkfehler.')
    } finally {
      setLoading(false)
    }
  }

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
          <Users className="h-7 w-7 text-[var(--accent)]/90" aria-hidden />
          Mitglieder-Übersicht
        </h1>
        <p className="dash-page-desc">
          Mitglieder mit Rollen und Beitrittsdatum. Suche ab 2 Zeichen (Discord-Suche). Ohne Suche: Sortierung wie in der
          Sidebar — zuerst nach höchster Rollen-Position, dann alphabetisch (bis ca. 2500 Mitglieder; größere Server:
          API-Reihenfolge, Hinweis erscheint unten).
        </p>
      </header>

      {listModeHint ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-2 text-sm text-amber-100/90">
          {listModeHint}
        </div>
      ) : null}

      <div className="dash-panel p-4 sm:p-5">
        <label className="block">
          <span className="dash-label">Suche (Name / Nickname)</span>
          <input
            className="dash-input mt-1 w-full max-w-xl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mindestens 2 Zeichen…"
          />
        </label>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      {totalMembers != null && debouncedQ.length < 2 ? (
        <p className="text-sm text-[var(--muted)]">
          {totalMembers} Mitglieder{rows.length < totalMembers ? ` · ${rows.length} angezeigt` : ''}
        </p>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Lade Mitglieder…</p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((m) => (
          <MemberBrowseCard key={m.id} m={m} />
        ))}
      </ul>

      {!loading && rows.length === 0 && !err ? (
        <p className="text-sm text-[var(--muted)]">Keine Treffer.</p>
      ) : null}

      {hasMore && !searchMode && debouncedQ.length < 2 ? (
        <div className="pt-4">
          <button type="button" className="dash-btn px-4" disabled={loading} onClick={() => void loadMore()}>
            {loading ? '…' : 'Weitere laden'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
