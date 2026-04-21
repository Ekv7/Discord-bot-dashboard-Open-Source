export type MemberBrowseRow = {
  id: string
  tag: string
  displayName: string
  avatarUrl: string | null
  joinedAt: number | null
  roles: { id: string; name: string; color: string | null }[]
}

function joinedLabel(ts: number | null) {
  if (ts == null) return '—'
  return new Date(ts).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MemberBrowseCard({ m }: { m: MemberBrowseRow }) {
  return (
    <li className="dash-list-row-hover rounded-xl border border-[var(--border)] bg-black/20 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0">
          {m.avatarUrl ? (
            <img src={m.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-[var(--border)]" width={44} height={44} />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-zinc-900 text-xs text-zinc-500">
              ?
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--foreground)]">{m.displayName}</p>
            <p className="truncate text-xs text-zinc-500">{m.tag}</p>
            <p className="font-mono text-[10px] text-zinc-600 [word-break:break-all] sm:text-[11px]">{m.id}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="dash-label">Beitritt</p>
          <p className="mt-0.5 text-sm tabular-nums text-zinc-300">{joinedLabel(m.joinedAt)}</p>
          <p className="dash-label mt-2">Rollen ({m.roles.length})</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {m.roles.length === 0 ? (
              <span className="text-xs text-zinc-600">Keine zusätzlichen Rollen</span>
            ) : (
              m.roles.map((r) => (
                <span
                  key={r.id}
                  className="max-w-full truncate rounded border border-[var(--border)] bg-black/30 px-2 py-0.5 text-[11px] text-zinc-300"
                  style={
                    r.color
                      ? { borderColor: `${r.color}55`, backgroundColor: `${r.color}18` }
                      : undefined
                  }
                  title={r.name}
                >
                  {r.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
