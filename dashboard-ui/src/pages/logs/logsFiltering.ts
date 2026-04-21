import type { Snapshot } from '@/hooks/useSnapshot'

type ServerLog = Snapshot['serverLogs'][number]

export type TypeFilter =
  | 'all'
  | 'moderation'
  | 'warn'
  | 'clearchat'
  | 'message'
  | 'kick'
  | 'ban'
  | 'audit'
  | 'dashboard'
  | 'other'

export const TYPE_FILTERS: TypeFilter[] = [
  'all',
  'moderation',
  'warn',
  'clearchat',
  'message',
  'kick',
  'ban',
  'audit',
  'dashboard',
  'other',
]

export const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'Alle',
  moderation: 'Moderation',
  warn: 'Verwarnung',
  clearchat: 'Chat leeren',
  message: 'Nachricht',
  kick: 'Kick',
  ban: 'Ban',
  audit: 'Audit',
  dashboard: 'Dashboard',
  other: 'Sonstige',
}

const MODERATION_TYPES = new Set([
  'mod_kick',
  'mod_ban',
  'mod_unban',
  'mod_mute',
  'mod_unmute',
  'mod_warn',
  'mod_unwarn',
  'mod_clearwarns',
  'mod_clearchat',
])

function matchesTypeFilter(log: ServerLog, typeFilter: TypeFilter): boolean {
  if (typeFilter === 'all') return true
  if (typeFilter === 'moderation') return MODERATION_TYPES.has(log.type)
  if (typeFilter === 'warn') return ['mod_warn', 'mod_unwarn', 'mod_clearwarns'].includes(log.type)
  if (typeFilter === 'clearchat') return log.type === 'mod_clearchat'
  if (typeFilter === 'message') return log.type === 'message'
  if (typeFilter === 'kick') return log.type === 'kick' || log.type === 'mod_kick'
  if (typeFilter === 'ban') return ['ban', 'mod_ban', 'mod_unban'].includes(log.type)
  if (typeFilter === 'audit') return log.type === 'audit'
  if (typeFilter === 'dashboard') return log.type === 'dashboard'
  return !MODERATION_TYPES.has(log.type)
}

function includesQuery(log: ServerLog, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const bag = [
    log.type,
    log.user,
    log.userId ?? '',
    log.msg,
    log.channel ?? '',
    log.executorTag ?? '',
    log.executorId ?? '',
    ...(log.executorRoles ?? []).map((role) => role.name),
  ]
    .join(' ')
    .toLowerCase()

  return bag.includes(q)
}

export function filterServerLogs(
  logs: Snapshot['serverLogs'],
  filters: {
    typeFilter: TypeFilter
    executorRoleId: string
    channelFilter: string
    q: string
    sortNewestFirst: boolean
  }
): Snapshot['serverLogs'] {
  const filteredRows = logs.filter((log) => {
    if (!matchesTypeFilter(log, filters.typeFilter)) return false
    if (filters.channelFilter !== 'all' && log.channel !== filters.channelFilter) return false
    if (
      filters.executorRoleId !== 'all' &&
      !(log.executorRoles ?? []).some((role) => role.id === filters.executorRoleId)
    ) {
      return false
    }
    if (!includesQuery(log, filters.q.trim())) return false
    return true
  })

  filteredRows.sort((left, right) => (filters.sortNewestFirst ? right.ts - left.ts : left.ts - right.ts))
  return filteredRows
}

export function uniqueChannelsFromLogs(logs: Snapshot['serverLogs']): string[] {
  const channelSet = new Set<string>()
  logs.forEach((log) => {
    if (log.channel) channelSet.add(log.channel)
  })
  return Array.from(channelSet).sort((left, right) => left.localeCompare(right, 'de'))
}
