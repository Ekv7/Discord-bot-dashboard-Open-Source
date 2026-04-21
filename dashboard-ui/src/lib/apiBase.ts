/**
 * Basis-URL des Bot-Dashboard-HTTP (ohne Slash am Ende).
 * Leer = gleiche Origin wie die geladene Seite (empfohlen: Reverse-Proxy alles zum Bot).
 * Setzen in Root-.env: VITE_DASHBOARD_API_BASE_URL=… (Vite lädt env aus dem Bot-Ordner).
 */
export function dashboardApiBase(): string {
  const raw = String(import.meta.env.VITE_DASHBOARD_API_BASE_URL ?? '').trim()
  return raw.replace(/\/+$/, '')
}

const RAW_API_PREFIX = String(import.meta.env.VITE_DASHBOARD_API_PREFIX ?? '').trim().replace(/\/+$/, '')

/**
 * Öffentlicher API-Pfad (/api/v1 empfohlen bei separater API-Domain).
 * VITE_DASHBOARD_API_PREFIX leer + Cross-Origin-API-Base → automatisch /api/v1.
 */
function effectiveApiPrefix(): string {
  if (RAW_API_PREFIX) return RAW_API_PREFIX
  if (dashboardApiBase()) return '/api/v1'
  return '/api'
}

/** Baut absolute URL für API, EventSource und <a href>. */
export function apiUrl(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`
  const prefix = effectiveApiPrefix()
  if (prefix !== '/api' && p.startsWith('/api/') && !p.startsWith(`${prefix}/`)) {
    p = `${prefix}${p.slice(4)}`
  }
  const b = dashboardApiBase()
  return b ? `${b}${p}` : p
}

/** ws(s)://host für WebSocket — gleiche Logik wie apiUrl für den Host-Teil. */
export function dashboardWsRoot(): string {
  const b = dashboardApiBase()
  if (!b) {
    const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${p}//${window.location.host}`
  }
  try {
    const u = new URL(b)
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${u.host}`
  } catch {
    const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${p}//${window.location.host}`
  }
}
