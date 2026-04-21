import { useEffect, useMemo, useState } from 'react'
import { dashboardWsRoot } from '@/lib/apiBase'

export type ActiveDashboardUser = {
  userId: string
  username: string
  avatarUrl: string | null
  initials: string
  guildId?: string
  connectedAt: number
  lastActiveAt: number
  activeForSec: number
}

type PresenceMessage = {
  type: 'presence'
  users: ActiveDashboardUser[]
  now: number
}

export function useDashboardPresence(enabled: boolean, selectedGuildId: string) {
  const [users, setUsers] = useState<ActiveDashboardUser[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) {
      const resetId = window.setTimeout(() => {
        setUsers([])
        setConnected(false)
      }, 0)
      return () => window.clearTimeout(resetId)
    }
    const guildQuery = selectedGuildId ? `?guildId=${encodeURIComponent(selectedGuildId)}` : ''
    let socket: WebSocket | null = null
    let heartbeatTimer: number | null = null
    let reconnectTimer: number | null = null
    let reconnectDelayMs = 1000
    let closed = false

    const clearHeartbeat = () => {
      if (heartbeatTimer != null) {
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const sendHeartbeat = (type: 'heartbeat' | 'focus' = 'heartbeat') => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      try {
        socket.send(JSON.stringify({ type }))
      } catch {
        // Socket kann während Tab-Wechsel geschlossen werden.
      }
    }

    const scheduleReconnect = () => {
      if (closed || reconnectTimer != null) return
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect()
      }, reconnectDelayMs)
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000)
    }

    const connect = () => {
      if (closed) return
      try {
        clearHeartbeat()
        if (socket) {
          try {
            socket.close()
          } catch {
            // ignore
          }
        }
        socket = new WebSocket(`${dashboardWsRoot()}/ws/presence${guildQuery}`)
      } catch {
        setConnected(false)
        scheduleReconnect()
        return
      }

      socket.addEventListener('open', () => {
        setConnected(true)
        reconnectDelayMs = 1000
        clearReconnect()
        sendHeartbeat('focus')
        heartbeatTimer = window.setInterval(() => sendHeartbeat('heartbeat'), 5000)
      })

      socket.addEventListener('message', event => {
        try {
          const data = JSON.parse(String(event.data)) as PresenceMessage
          if (data?.type === 'presence' && Array.isArray(data.users)) {
            const filtered = selectedGuildId
              ? data.users.filter((u) => String(u.guildId || '') === selectedGuildId)
              : data.users
            setUsers(filtered)
          }
        } catch {
          // Nur Presence-JSON wird verarbeitet.
        }
      })

      socket.addEventListener('close', () => {
        setConnected(false)
        clearHeartbeat()
        scheduleReconnect()
      })

      socket.addEventListener('error', () => {
        setConnected(false)
        scheduleReconnect()
      })
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat('focus')
        if (!socket || socket.readyState !== WebSocket.OPEN) scheduleReconnect()
      }
    }
    const onOnline = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) scheduleReconnect()
    }

    connect()
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      closed = true
      clearReconnect()
      clearHeartbeat()
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      try {
        socket?.close()
      } catch {
        // already closed
      }
    }
  }, [enabled, selectedGuildId])

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => right.lastActiveAt - left.lastActiveAt),
    [users]
  )

  return { users: sortedUsers, connected }
}

