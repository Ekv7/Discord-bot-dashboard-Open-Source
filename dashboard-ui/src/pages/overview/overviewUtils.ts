import type { Snapshot } from '@/hooks/useSnapshot'

export function statusLabel(s: string | undefined) {
  const m: Record<string, string> = {
    online: 'Online',
    idle: 'Abwesend',
    dnd: 'Bitte nicht stören',
    invisible: 'Unsichtbar',
    offline: 'Offline',
  }
  return m[s || ''] || s || '—'
}

export function formatActivity(a: Snapshot['bot']['activity'] | null | undefined) {
  if (!a?.name) return ''
  const verbs = ['Spielt', 'Streamt', 'Hört', 'Schaut', 'Status', 'Wettet um']
  const v = verbs[a.type] ?? 'Aktivität'
  const extra = a.state ? ` · ${a.state}` : ''
  return `${v}: ${a.name}${extra}`
}

export function formatUptime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(0, m)}m`
}
