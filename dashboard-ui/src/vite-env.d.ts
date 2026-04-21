/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Öffentliche Basis-URL des Bot-Dashboard-HTTP (ohne Slash am Ende). Leer = gleiche Origin. */
  readonly VITE_DASHBOARD_API_BASE_URL?: string
  /** API-Pfad z. B. /api/v1 — leer + VITE_DASHBOARD_API_BASE_URL gesetzt → /api/v1 */
  readonly VITE_DASHBOARD_API_PREFIX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
