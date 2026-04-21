type LookupRow =
  | { kind: 'member'; id: string; tag: string; displayName: string; avatarUrl: string }
  | { kind: 'banned'; id: string; tag: string; avatarUrl: string }

type ModAction = 'kick' | 'ban' | 'unban' | 'mute' | 'unmute'

type Props = {
  selected: LookupRow
  onAction: (action: ModAction, target: LookupRow) => void
}

export function ModerationActionBar({ selected, onAction }: Props) {
  const headline =
    selected.kind === 'banned'
      ? `Aktion für ${selected.tag}: Unban`
      : `Aktion für ${selected.tag}: Kick, Ban, Mute, Unmute`

  return (
    <div className="dash-panel space-y-3 p-4">
      <div>
        <p className="dash-label">{headline}</p>
        {selected.kind === 'member' ? (
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
            Unban: gebannte Nutzer per User-ID suchen und den Eintrag „Gebannt“ auswählen.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.kind === 'banned' ? (
          <button type="button" className="dash-btn px-3 py-1.5 text-sm" onClick={() => onAction('unban', selected)}>
            Unban
          </button>
        ) : (
          <>
            <button type="button" className="dash-btn px-3 py-1.5 text-sm" onClick={() => onAction('kick', selected)}>
              Kick
            </button>
            <button type="button" className="dash-btn px-3 py-1.5 text-sm" onClick={() => onAction('ban', selected)}>
              Ban
            </button>
            <button type="button" className="dash-btn px-3 py-1.5 text-sm" onClick={() => onAction('mute', selected)}>
              Mute
            </button>
            <button type="button" className="dash-btn px-3 py-1.5 text-sm" onClick={() => onAction('unmute', selected)}>
              Unmute
            </button>
          </>
        )}
      </div>
    </div>
  )
}
