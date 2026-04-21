type ModAction = 'kick' | 'ban' | 'unban' | 'mute' | 'unmute'

type LookupRow =
  | { kind: 'member'; id: string; tag: string; displayName: string; avatarUrl: string }
  | { kind: 'banned'; id: string; tag: string; avatarUrl: string }

type Pending = { action: ModAction; target: LookupRow }

type Props = {
  pending: Pending
  reason: string
  muteMinutes: number
  submitting: boolean
  onReasonChange: (v: string) => void
  onMuteMinutesChange: (v: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ModerationConfirmModal({
  pending,
  reason,
  muteMinutes,
  submitting,
  onReasonChange,
  onMuteMinutesChange,
  onConfirm,
  onCancel,
}: Props) {
  const title =
    pending.action === 'kick'
      ? 'Kick'
      : pending.action === 'ban'
        ? 'Ban'
        : pending.action === 'unban'
          ? 'Unban'
          : pending.action === 'mute'
            ? 'Mute (Timeout)'
            : 'Unmute'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:p-4 sm:pb-4 sm:pt-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-confirm-title"
    >
      <div className="dash-panel max-h-[min(92dvh,90vh)] w-full max-w-md overflow-y-auto overscroll-contain p-5 shadow-xl sm:max-h-[90vh]">
        <h2 id="mod-confirm-title" className="text-lg font-semibold text-[var(--foreground)]">
          {title} — {pending.target.tag}
        </h2>
        {pending.action === 'mute' ? (
          <label className="mt-3 block">
            <span className="dash-label">Minuten</span>
            <input
              type="number"
              min={1}
              max={40320}
              value={muteMinutes}
              onChange={(e) => onMuteMinutesChange(Number(e.target.value))}
              className="dash-input mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label className="mt-3 block">
          <span className="dash-label">{pending.action === 'ban' ? 'Grund (Pflicht)' : 'Grund (optional)'}</span>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value.slice(0, 400))}
            rows={3}
            className="dash-input mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="dash-btn dash-btn-accent px-4 py-2 text-sm font-semibold"
            disabled={submitting}
            onClick={() => void onConfirm()}
          >
            {submitting ? '…' : 'Ausführen'}
          </button>
          <button type="button" className="dash-btn px-4 py-2 text-sm" disabled={submitting} onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
