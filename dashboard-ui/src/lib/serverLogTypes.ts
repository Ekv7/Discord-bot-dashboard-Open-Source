/**
 * Eine Quelle für Labels und Badge-Farben (Listenzeile vs. Übersicht).
 * Unbekannte `type`-Strings fallen auf Roh-Typ + neutrale Badges zurück.
 */
const META: Record<string, { label: string; row: string; overview: string }> = {
  message: {
    label: 'Nachricht',
    row: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    overview: 'bg-cyan-500/12 text-cyan-300 ring-cyan-500/20',
  },
  channel: {
    label: 'Kanal',
    row: 'border-teal-500/20 bg-teal-500/10 text-teal-300',
    overview: 'bg-teal-500/12 text-teal-300 ring-teal-500/20',
  },
  nickname: {
    label: 'Nickname',
    row: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
    overview: 'bg-fuchsia-500/12 text-fuchsia-300 ring-fuchsia-500/20',
  },
  member_upd: {
    label: 'Mitglied',
    row: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
    overview: 'bg-orange-500/12 text-orange-300 ring-orange-500/20',
  },
  invite: {
    label: 'Einladung',
    row: 'border-lime-500/20 bg-lime-500/10 text-lime-300',
    overview: 'bg-lime-500/12 text-lime-300 ring-lime-500/20',
  },
  join: {
    label: 'Beitritt',
    row: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    overview: 'bg-emerald-500/12 text-emerald-400 ring-emerald-500/20',
  },
  leave: {
    label: 'Verlassen',
    row: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    overview: 'bg-zinc-500/12 text-zinc-400 ring-zinc-500/20',
  },
  kick: {
    label: 'Kick',
    row: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    overview: 'bg-amber-500/12 text-amber-300 ring-amber-500/20',
  },
  ban: {
    label: 'Ban',
    row: 'border-red-500/25 bg-red-500/10 text-red-300',
    overview: 'bg-red-500/12 text-red-300 ring-red-500/20',
  },
  cmd: {
    label: 'Befehl',
    row: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    overview: 'bg-sky-500/12 text-sky-300 ring-sky-500/20',
  },
  voice: {
    label: 'Voice',
    row: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    overview: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
  },
  audit: {
    label: 'Audit',
    row: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    overview: 'bg-amber-500/12 text-amber-300 ring-amber-500/20',
  },
  role: {
    label: 'Rolle',
    row: 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]',
    overview: 'bg-[var(--accent)]/12 text-[var(--accent)] ring-[var(--accent)]/25',
  },
  mod_kick: {
    label: 'Kick (Slash)',
    row: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    overview: 'bg-amber-500/12 text-amber-300 ring-amber-500/20',
  },
  mod_ban: {
    label: 'Ban (Slash)',
    row: 'border-red-500/25 bg-red-500/10 text-red-300',
    overview: 'bg-red-500/12 text-red-300 ring-red-500/20',
  },
  mod_unban: {
    label: 'Unban (Slash)',
    row: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
    overview: 'bg-rose-500/12 text-rose-300 ring-rose-500/20',
  },
  mod_mute: {
    label: 'Mute (Slash)',
    row: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
    overview: 'bg-indigo-500/12 text-indigo-300 ring-indigo-500/20',
  },
  mod_unmute: {
    label: 'Unmute (Slash)',
    row: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    overview: 'bg-sky-500/12 text-sky-300 ring-sky-500/20',
  },
  mod_warn: {
    label: 'Verwarnung (Slash)',
    row: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    overview: 'bg-amber-500/12 text-amber-200 ring-amber-500/20',
  },
  mod_unwarn: {
    label: 'Verwarnung entfernt',
    row: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200',
    overview: 'bg-yellow-500/12 text-yellow-200 ring-yellow-500/20',
  },
  mod_clearwarns: {
    label: 'Verwarnungen gelöscht',
    row: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
    overview: 'bg-orange-500/12 text-orange-200 ring-orange-500/20',
  },
  mod_clearchat: {
    label: 'Chat geleert',
    row: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
    overview: 'bg-sky-500/12 text-sky-200 ring-sky-500/20',
  },
  dashboard: {
    label: 'Dashboard',
    row: 'border-slate-500/25 bg-slate-500/10 text-slate-200',
    overview: 'bg-slate-500/12 text-slate-200 ring-slate-500/25',
  },
  automod: {
    label: 'Auto-Mod',
    row: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
    overview: 'bg-rose-500/12 text-rose-200 ring-rose-500/25',
  },
}

const ROW_FALLBACK = 'border-[var(--border)] bg-white/[0.04] text-zinc-400'
const OVERVIEW_FALLBACK = 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20'

export function serverLogTypeLabel(type: string) {
  return META[type]?.label ?? type
}

export function serverLogRowBadgeClass(type: string) {
  return META[type]?.row ?? ROW_FALLBACK
}

export function serverLogOverviewBadgeClass(type: string) {
  return META[type]?.overview ?? OVERVIEW_FALLBACK
}
