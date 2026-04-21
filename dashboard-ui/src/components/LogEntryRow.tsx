import type { Snapshot } from '@/hooks/useSnapshot'
import { serverLogRowBadgeClass, serverLogTypeLabel } from '@/lib/serverLogTypes'

type LogRow = Snapshot['serverLogs'][number]

function plainLogMessage(input: string): string {
  const safe = String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
  return safe
}

function TypeBadge({ type }: { type: string }) {
  const cls = serverLogRowBadgeClass(type)
  const label = serverLogTypeLabel(type)
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide ${cls}`}
    >
      {label}
    </span>
  )
}

function ExecutorRoleChips({ roles, className }: { roles: { id: string; name: string }[]; className?: string }) {
  if (!roles.length) return null
  return (
    <div className={className ?? 'mt-1.5 flex flex-wrap gap-1'}>
      {roles.map((er) => (
        <span
          key={er.id}
          className="max-w-full truncate rounded border border-[var(--border)] bg-black/25 px-1.5 py-0.5 text-[10px] text-zinc-400"
          title={er.name}
        >
          {er.name}
        </span>
      ))}
    </div>
  )
}

/** Erste Zeile: wer ist in `user` / `userId` in diesem Log-Typ? */
function primaryActorLabel(l: LogRow): string {
  if (l.type === 'message' && (l.user === '—' || l.user === '–')) {
    return 'Kontext'
  }
  switch (l.type) {
    case 'join':
    case 'leave':
    case 'ban':
      return 'Mitglied'
    case 'kick':
      return 'Betroffener (gekickt)'
    case 'message':
      return 'Autor der Nachricht'
    case 'channel':
      return 'Server (Guild)'
    case 'nickname':
    case 'member_upd':
      return 'Mitglied'
    case 'invite':
      return 'Invite erstellt / gelöscht von'
    case 'voice':
      return 'Mitglied (Voice)'
    case 'audit':
      return 'Ausgeführt von (Audit)'
    case 'cmd':
      return 'Spieler (Slash / Button)'
    case 'mod_kick':
    case 'mod_ban':
    case 'mod_unban':
    case 'mod_mute':
    case 'mod_unmute':
    case 'mod_warn':
    case 'mod_unwarn':
    case 'mod_clearwarns':
    case 'mod_clearchat':
      return 'Spieler (Moderation per /)'
    case 'dashboard':
      return 'Dashboard-Nutzer'
    case 'automod':
      return 'Autor (Auto-Mod)'
    case 'role':
      return 'Rolle / Ausführend'
    default:
      return 'Nutzer'
  }
}

function ActorBlock({ title, tag, id }: { title: string; tag: string; id: string | null | undefined }) {
  return (
    <div className="mt-2 rounded-lg border border-zinc-700/40 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-zinc-100">{tag || '—'}</span>
        {id ? (
          <span className="font-mono text-[11px] text-zinc-500 [word-break:break-all]" title="Discord-ID">
            {id}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600">keine User-ID</span>
        )}
      </div>
    </div>
  )
}

export function LogEntryRow({ l }: { l: LogRow }) {
  const bulkMessage = l.type === 'message' && (l.user === '—' || l.user === '–') && !l.userId

  return (
    <li className="dash-list-row-hover px-4 py-4 transition-colors sm:px-5">
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <time
          className="text-xs tabular-nums text-zinc-500"
          dateTime={new Date(l.ts).toISOString()}
        >
          {new Date(l.ts).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </time>
        <TypeBadge type={l.type} />
        {l.simulated ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-400/90">Simuliert</span>
        ) : null}
      </div>

      {bulkMessage ? (
        <p className="mt-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-xs text-zinc-500">
          <span className="font-semibold uppercase tracking-wide text-zinc-600">Mehrere Autoren</span>
          {' — '}
          Namen und Texte stehen im Detailbereich unten.
        </p>
      ) : (
        <ActorBlock title={primaryActorLabel(l)} tag={l.user} id={l.userId} />
      )}

      {l.type === 'kick' && (l.executorTag || l.executorId) ? (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
            Ausgeführt von (Kicker)
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium text-zinc-100">{l.executorTag ?? '—'}</span>
            {l.executorId ? (
              <span className="font-mono text-[11px] text-zinc-500 [word-break:break-all]">{l.executorId}</span>
            ) : null}
          </div>
          <ExecutorRoleChips roles={l.executorRoles ?? []} className="mt-2 flex flex-wrap gap-1" />
        </div>
      ) : null}

      {l.type === 'message' && (l.executorTag || l.executorId) ? (
        <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/90">
            Gelöscht von (Moderator)
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium text-zinc-100">{l.executorTag ?? '—'}</span>
            {l.executorId ? (
              <span className="font-mono text-[11px] text-zinc-500 [word-break:break-all]">{l.executorId}</span>
            ) : null}
          </div>
          <ExecutorRoleChips roles={l.executorRoles ?? []} className="mt-2 flex flex-wrap gap-1" />
        </div>
      ) : null}

      {l.type === 'audit' && l.executorRoles && l.executorRoles.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Rollen des Ausführers
          </p>
          <ExecutorRoleChips roles={l.executorRoles} className="mt-2 flex flex-wrap gap-1" />
        </div>
      ) : null}

      {l.type !== 'kick' &&
      l.type !== 'audit' &&
      !(l.type === 'message' && (l.executorTag || l.executorId)) &&
      l.executorRoles &&
      l.executorRoles.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Zugeordnete Rollen</p>
          <ExecutorRoleChips roles={l.executorRoles} className="mt-2 flex flex-wrap gap-1" />
        </div>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{plainLogMessage(l.msg)}</p>

      {l.channel ? (
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          <span className="text-zinc-600">Kanal: </span>#{l.channel}
        </p>
      ) : null}
    </li>
  )
}
