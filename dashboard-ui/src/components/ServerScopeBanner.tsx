import { Radio } from 'lucide-react'

/** Aktuell gewählter Discord-Server (Header-Dropdown) */
export type DashboardServerScope = {
  guildId: string
  guildName: string | null
  members: number | null
  multiGuild: boolean
  /** Fehler von /api/guilds (z. B. 403 Rollenprüfung) */
  guildsLoadError?: string | null
  /** Erster erfolgreicher Abruf ohne Einträge */
  guildsLoadedEmpty?: boolean
}

export function ServerScopeBanner({ scope }: { scope: DashboardServerScope }) {
  if (scope.guildsLoadError) {
    return (
      <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200/95">
        <p className="font-medium text-red-100">Serverliste</p>
        <p className="mt-1 leading-relaxed">{scope.guildsLoadError}</p>
        <p className="mt-2 text-xs text-red-200/80">
          Tipp: Bot muss auf dem Auth-Server sein (siehe DASHBOARD_AUTH_GUILD_ID) und du brauchst die Rolle aus
          DASHBOARD_ACCESS_ROLE_ID. Bei Problemen kurz ab- und wieder anmelden.
        </p>
      </div>
    )
  }

  if (!scope.guildId) {
    if (scope.guildsLoadedEmpty) {
      return (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/95">
          Der Bot ist auf keinem Discord-Server oder noch nicht verbunden. Einladen und Prozess prüfen.
        </div>
      )
    }
    return (
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/95">
        {scope.multiGuild
          ? 'Bitte oben einen Server wählen — Daten sind pro Server getrennt.'
          : 'Serverliste wird geladen…'}
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)]/55 px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <Radio className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]/85" aria-hidden />
        <span className="font-semibold text-[var(--foreground)]/90">{scope.guildName || 'Server'}</span>
        {scope.members != null ? (
          <span className="tabular-nums text-[var(--muted)]">· {scope.members} Mitglieder</span>
        ) : null}
        <span className="font-mono text-[10px] text-zinc-500">· {scope.guildId}</span>
      </div>
      {scope.multiGuild ? (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">Wechsel im Dropdown oben — gilt für diese Seite.</p>
      ) : null}
    </div>
  )
}
