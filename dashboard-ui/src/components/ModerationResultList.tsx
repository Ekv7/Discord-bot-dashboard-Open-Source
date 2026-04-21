type LookupRow =
  | { kind: 'member'; id: string; tag: string; displayName: string; avatarUrl: string }
  | { kind: 'banned'; id: string; tag: string; avatarUrl: string }

type Props = {
  results: LookupRow[]
  selected: LookupRow | null
  onSelect: (row: LookupRow) => void
}

export function ModerationResultList({ results, selected, onSelect }: Props) {
  if (results.length === 0) return null
  return (
    <ul className="mb-4 space-y-2">
      {results.map((row) => (
        <li key={`${row.kind}-${row.id}`}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              selected?.id === row.id && selected?.kind === row.kind
                ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--card)]/40 hover:bg-white/5'
            }`}
          >
            <img src={row.avatarUrl} alt="" className="h-10 w-10 rounded-full" width={40} height={40} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--foreground)]">
                {row.kind === 'member' ? row.displayName : row.tag}
                {row.kind === 'member' ? (
                  <span className="ml-2 font-normal text-[var(--muted)]">@{row.tag}</span>
                ) : null}
              </p>
              <p className="font-mono text-xs text-zinc-500">{row.id}</p>
              {row.kind === 'banned' ? <span className="text-xs text-amber-200/90">Gebannt</span> : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
