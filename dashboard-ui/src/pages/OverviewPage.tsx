import {
  Users,
  Terminal,
  Shield,
  AlertCircle,
  Hash,
  Radio,
  Wifi,
  Timer,
} from 'lucide-react'
import type { Snapshot } from '@/hooks/useSnapshot'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'
import { MetaRow, OverviewRecentEvents, StatCard } from '@/pages/overview/OverviewBlocks'
import { formatActivity, formatUptime, statusLabel } from '@/pages/overview/overviewUtils'

export function OverviewPage({
  data,
  error,
  serverScope,
}: {
  data: Snapshot | null
  error: string | null
  serverScope: DashboardServerScope
}) {
  if (error) {
    return (
      <div className="dash-page-shell-loose">
        <ServerScopeBanner scope={serverScope} />
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    )
  }
  if (!serverScope.guildId) {
    return (
      <div className="dash-page-shell-loose">
        <ServerScopeBanner scope={serverScope} />
        <p className="text-sm text-[var(--muted)]">
          Bitte einen Server auswählen oder warten, bis die Server-Liste geladen ist.
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="dash-page-shell-loose">
        <ServerScopeBanner scope={serverScope} />
        <p className="text-sm text-[var(--muted)]">Lade Übersicht…</p>
      </div>
    )
  }

  const s = data.stats
  const recent = data.serverLogs.slice(0, 200)
  const h = data.health
  const online = data.bot.ready && data.bot.tag
  const previewCmds = data.commands.slice(0, 6)

  return (
    <div className="dash-page-shell-loose">
      <ServerScopeBanner scope={serverScope} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="dash-page-title">Übersicht</h1>
          <p className="dash-page-desc mt-2 flex flex-wrap items-center gap-2">
            {data.guild.name ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-0.5 text-xs font-medium text-[var(--foreground)]/90">
                <Radio className="h-3 w-3 text-[var(--muted)]" aria-hidden />
                {data.guild.name}
              </span>
            ) : null}
            <span className="text-[var(--muted)]">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`}
              />
              {online ? 'Bot verbunden' : 'Bot offline / lädt'}
            </span>
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Mitglieder"
          value={s.members ?? '—'}
          hint={data.guild.name || 'Server'}
          tone="blue"
        />
        <StatCard
          icon={Terminal}
          label="Slash heute"
          value={s.commandsToday}
          hint="Ausführungen"
          tone="emerald"
        />
        <StatCard
          icon={Shield}
          label="Rollen heute"
          value={s.rolesToday}
          hint={`+${s.rolesGivenToday} / −${s.rolesRemovedToday}`}
          tone="amber"
        />
        <StatCard
          icon={AlertCircle}
          label="Fehler (Session)"
          value={s.errorsSession}
          hint="seit Start"
          tone="red"
        />
      </section>

      {h ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={Wifi}
            label="Gateway-Ping"
            value={h.pingMs != null ? `${Math.round(h.pingMs)} ms` : '—'}
            hint="Discord WebSocket"
            tone="emerald"
          />
          <StatCard
            icon={Timer}
            label="Bot-Uptime"
            value={formatUptime(h.uptimeMs)}
            hint="seit Prozessstart"
            tone="blue"
          />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <OverviewRecentEvents recent={recent} totalCount={data.serverLogs.length} />

        <aside className="space-y-4 lg:col-span-2">
          <div className="dash-panel">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="dash-section-title">Bot</h2>
            </div>
            <dl className="space-y-0 px-4 py-2">
              <MetaRow label="Name" value={data.bot.tag || '—'} />
              <MetaRow label="Status" value={statusLabel(data.bot.status ?? 'offline')} />
              <MetaRow label="Aktivität" value={formatActivity(data.bot.activity ?? null) || '—'} mono={false} />
              <MetaRow label="Framework" value="discord.js v14" />
              <MetaRow label="Slash-Befehle" value={String(data.commands.length)} />
              {data.buttons.length > 0 ? (
                <MetaRow label="Button-Aktionen" value={String(data.buttons.length)} />
              ) : null}
            </dl>
          </div>

          {previewCmds.length > 0 ? (
            <div className="dash-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <Hash className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                <h2 className="dash-section-title">Slash-Befehle</h2>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                  <span className="rounded-md border border-[var(--border)] bg-black/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-400">
                    {data.commands.length}{' '}
                    {data.commands.length === 1 ? 'Befehl' : 'Befehle'}
                  </span>
                  {data.buttons.length > 0 ? (
                    <span className="rounded-md border border-pink-500/15 bg-pink-500/5 px-2 py-0.5 text-[11px] font-medium tabular-nums text-pink-300/85">
                      {data.buttons.length}{' '}
                      {data.buttons.length === 1 ? 'Button' : 'Buttons'}
                    </span>
                  ) : null}
                </div>
              </div>
              <ul className="max-h-[220px] space-y-0 overflow-y-auto p-2">
                {previewCmds.map((c) => (
                  <li
                    key={c.name}
                    className="dash-list-row-hover rounded-lg px-2 py-2 text-sm text-[var(--foreground)]/90"
                    title={c.description}
                  >
                    <span className="font-mono text-xs text-[var(--accent)]">/{c.name}</span>
                    {c.description ? (
                      <p className="dash-hint mt-0.5 line-clamp-2 leading-snug">
                        {c.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
