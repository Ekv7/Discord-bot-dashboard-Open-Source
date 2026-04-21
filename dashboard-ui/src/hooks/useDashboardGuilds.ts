import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

export type DashboardGuild = {
  id: string
  name: string
  members: number | null
  isOwner?: boolean
  /** false = Bot nicht mehr auf dem Server (Daten evtl. noch auf Platte) */
  botPresent?: boolean
}

export function useDashboardGuilds(enabled: boolean) {
  const [guilds, setGuilds] = useState<DashboardGuild[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetchAttempted, setFetchAttempted] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoadError(null)
      const response = await fetch(apiUrl('/api/guilds'), { credentials: 'include' })
      const json = (await response.json().catch(() => ({}))) as { guilds?: unknown; error?: string }
      if (!response.ok) {
        setGuilds([])
        setLoadError(
          typeof json.error === 'string' && json.error.trim()
            ? json.error
            : `Serverliste nicht ladbar (HTTP ${response.status}).`
        )
        return
      }
      setGuilds(Array.isArray(json.guilds) ? (json.guilds as DashboardGuild[]) : [])
    } catch {
      setGuilds([])
      setLoadError('Netzwerkfehler beim Laden der Serverliste.')
    } finally {
      setFetchAttempted(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setFetchAttempted(false)
      return
    }
    void load()
  }, [load, enabled])

  return { guilds, loadError, fetchAttempted, reloadGuilds: load }
}
