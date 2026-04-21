import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

export type Snapshot = {
  health?: {
    uptimeMs: number
    pingMs: number | null
  }
  bot: {
    tag: string | null
    id: string | null
    ready: boolean
    status: string
    activity: { name: string; type: number; state: string | null } | null
  }
  guild: { name: string | null; members: number | null }
  stats: {
    members: number | null
    commandsToday: number
    rolesToday: number
    rolesGivenToday: number
    rolesRemovedToday: number
    errorsSession: number
  }
  commands: { name: string; description: string; custom?: boolean; guildId?: string }[]
  buttons: { label: string; description: string; usageKey: string }[]
  usage: Record<string, number>
  serverLogs: {
    ts: number
    type: string
    user: string
    userId?: string | null
    guildId?: string | null
    msg: string
    channel: string | null
    simulated?: boolean
    executorTag?: string
    executorId?: string | null
    executorRoles?: { id: string; name: string }[]
  }[]
}

export function useSnapshot(selectedGuildId: string, intervalMs = 15000) {
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedGuildId) {
      setData(null)
      setError(null)
      return
    }
    try {
      const query = `?guildId=${encodeURIComponent(selectedGuildId)}`
      const r = await fetch(apiUrl(`/api/snapshot${query}`), { credentials: 'include' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Snapshot fehlgeschlagen')
      setData(j)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
  }, [selectedGuildId])

  useEffect(() => {
    if (!selectedGuildId) return
    void load()
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load, intervalMs, selectedGuildId])

  return { data, error, reload: load }
}
