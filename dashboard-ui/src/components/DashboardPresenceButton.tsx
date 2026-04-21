import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Users } from 'lucide-react'
import type { ActiveDashboardUser } from '@/hooks/useDashboardPresence'

const PANEL_RESERVE_PX = 288
const FALLBACK_Z = 2_147_483_647

function supportsPopoverApi(): boolean {
  return typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype
}

/** Nur Container am Ende von body — kein Vollbild-Overlay (Pointer-Events bleiben normal). */
function getPresencePortalRoot(): HTMLElement {
  let el = document.getElementById('dash-presence-panel-root') as HTMLElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = 'dash-presence-panel-root'
    document.body.appendChild(el)
  }
  document.body.appendChild(el)
  return el
}

function formatDuration(activeForSec: number) {
  const minutes = Math.floor(activeForSec / 60)
  const seconds = activeForSec % 60
  if (minutes < 1) return `${seconds}s`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/** Bevorzugt nach oben öffnen, damit der Hauptbereich (Überschriften) frei bleibt. */
function computePanelStyle(buttonEl: HTMLButtonElement): CSSProperties {
  const r = buttonEl.getBoundingClientRect()
  const w = Math.min(300, window.innerWidth - 24)
  let left = r.right - w
  left = Math.max(12, Math.min(left, window.innerWidth - w - 12))
  const spaceAbove = r.top
  const spaceBelow = window.innerHeight - r.bottom
  const minUp = 160
  const openUp = spaceAbove >= minUp && (spaceAbove >= spaceBelow || spaceBelow < PANEL_RESERVE_PX)

  const base: CSSProperties = supportsPopoverApi()
    ? { position: 'fixed', left, width: w }
    : { position: 'fixed', left, width: w, zIndex: FALLBACK_Z }

  if (openUp) {
    return {
      ...base,
      bottom: window.innerHeight - r.top + 8,
      maxHeight: Math.min(PANEL_RESERVE_PX, Math.max(120, r.top - 16)),
    }
  }
  return {
    ...base,
    top: r.bottom + 8,
    maxHeight: Math.min(PANEL_RESERVE_PX, Math.max(120, window.innerHeight - r.bottom - 16)),
  }
}

type DashboardPresenceButtonProps = {
  users: ActiveDashboardUser[]
  connected: boolean
  className?: string
}

export function DashboardPresenceButton({ users, connected, className = '' }: DashboardPresenceButtonProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const usePopover = supportsPopoverApi()

  const updatePosition = useCallback(() => {
    if (!open || !buttonRef.current) return
    setPanelStyle(computePanelStyle(buttonRef.current))
  }, [open])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    setPanelStyle(computePanelStyle(buttonRef.current))

    let cancelled = false
    let rafOuter = 0
    let rafInner = 0
    /** Beim Cleanup dieselbe Node wie beim Öffnen (ref kann zwischenzeitlich wechseln). */
    let openedPopoverEl: HTMLDivElement | null = null

    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(() => {
        if (cancelled || !usePopover) return
        const el = panelRef.current
        if (!el) return
        openedPopoverEl = el
        try {
          if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
            el.showPopover()
          }
        } catch {
          /* noop */
        }
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafOuter)
      cancelAnimationFrame(rafInner)
      const el = openedPopoverEl
      if (el && usePopover) {
        try {
          if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
            el.hidePopover()
          }
        } catch {
          /* noop */
        }
      }
    }
  }, [open, usePopover, users.length])

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const panel =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        id="dashboard-presence-panel"
        role="region"
        aria-labelledby="dashboard-presence-trigger"
        {...(usePopover ? { popover: 'manual' as const } : {})}
        style={panelStyle}
        className="pointer-events-auto box-border flex flex-col rounded-xl border border-[var(--border)] bg-zinc-950 p-2.5 text-zinc-100 shadow-2xl ring-1 ring-white/10"
      >
        <div className="mb-2 flex shrink-0 items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Aktiv im Dashboard</p>
          <span className={`text-[11px] ${connected ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {users.length === 0 ? (
            <p className="px-1 text-xs text-zinc-500">{connected ? 'Niemand aktiv' : 'Verbinde...'}</p>
          ) : (
            users.map(user => (
              <div key={user.userId} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-700/70">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-200">
                      {user.initials || '?'}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-zinc-950 bg-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-100">{user.username}</p>
                  <p className="text-[11px] text-zinc-400">aktiv seit {formatDuration(user.activeForSec)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    ) : null

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`dash-btn h-9 gap-2 px-3 ${className}`.trim()}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-controls="dashboard-presence-panel"
        id="dashboard-presence-trigger"
      >
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
        <Users className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Aktive Nutzer</span>
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200">{users.length}</span>
      </button>
      {panel ? createPortal(panel, getPresencePortalRoot()) : null}
    </div>
  )
}
