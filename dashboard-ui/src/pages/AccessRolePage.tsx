import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

type GuildRole = {
  id: string
  name: string
  color: string | null
}

type RoleMember = {
  id: string
  username: string
  displayName: string
}

export function AccessRolePage({ selectedGuildId }: { selectedGuildId: string }) {
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [roleMembers, setRoleMembers] = useState<RoleMember[]>([])
  const [membersMode, setMembersMode] = useState<'role' | 'owner_only'>('owner_only')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    if (!selectedGuildId) return
    try {
      const response = await fetch(apiUrl(`/api/access-role/members?guildId=${encodeURIComponent(selectedGuildId)}`), {
        credentials: 'include',
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `Fehler ${response.status}`)
      setRoleMembers(Array.isArray(json.members) ? (json.members as RoleMember[]) : [])
      setMembersMode(json.mode === 'role' ? 'role' : 'owner_only')
    } catch (error) {
      setRoleMembers([])
      setMembersMode('owner_only')
      setMessage(error instanceof Error ? error.message : 'Rolleninhaber konnten nicht geladen werden.')
    }
  }, [selectedGuildId])

  const load = useCallback(async () => {
    if (!selectedGuildId) return
    setLoading(true)
    setMessage(null)
    try {
      const [rolesRes, currentRes] = await Promise.all([
        fetch(apiUrl(`/api/guild-roles?guildId=${encodeURIComponent(selectedGuildId)}`), { credentials: 'include' }),
        fetch(apiUrl(`/api/access-role?guildId=${encodeURIComponent(selectedGuildId)}`), { credentials: 'include' }),
      ])
      const rolesJson = await rolesRes.json().catch(() => ({}))
      const currentJson = await currentRes.json().catch(() => ({}))
      if (!rolesRes.ok) throw new Error(rolesJson.error || `Fehler ${rolesRes.status}`)
      if (!currentRes.ok) throw new Error(currentJson.error || `Fehler ${currentRes.status}`)
      setRoles(Array.isArray(rolesJson.roles) ? (rolesJson.roles as GuildRole[]) : [])
      setSelectedRoleId(typeof currentJson.roleId === 'string' ? currentJson.roleId : '')
      await loadMembers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }, [selectedGuildId, loadMembers])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!selectedGuildId || !selectedRoleId) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(apiUrl('/api/access-role'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: selectedGuildId, roleId: selectedRoleId }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(typeof json.error === 'string' ? json.error : `Fehler ${response.status}`)
        return
      }
      setSelectedRoleId(typeof json.roleId === 'string' ? json.roleId : '')
      setMessage('Gespeichert: Dashboard-Zugriffsrolle aktualisiert.')
      await loadMembers()
    } catch {
      setMessage('Netzwerkfehler.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dash-page-shell-xs">
      <header>
        <h1 className="dash-page-title">Dashboard-Zugriff</h1>
        <p className="dash-page-desc">
          Als Server-Owner waehlst du hier die Rolle, die Teammitgliedern Dashboard-Zugriff gibt. Discord
          „Administrator“ ersetzt diese Rolle nicht — ohne die Rolle kommt nur der Owner rein.
        </p>
      </header>

      <div className="dash-panel space-y-4 p-5">
        <label className="block">
          <span className="dash-label">Zugriffsrolle</span>
          <select
            className="dash-input mt-1 w-full"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            disabled={loading || saving}
          >
            <option value="" disabled>
              Rolle auswählen (Pflicht)…
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="dash-btn dash-btn-accent px-4"
            disabled={saving || loading || !selectedRoleId}
            onClick={() => void save()}
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
          <button type="button" className="dash-btn px-4" disabled={saving || loading} onClick={() => void load()}>
            Neu laden
          </button>
        </div>

        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">Wer hat Zugriff über Rolle</p>
          {membersMode !== 'role' ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Aktuell keine Zugriffsrolle gesetzt - nur der Server-Owner kann ins Dashboard.
            </p>
          ) : roleMembers.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Niemand hat aktuell diese Rolle.</p>
          ) : (
            <div className="mt-2 max-h-56 overflow-y-auto">
              {roleMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="truncate pr-2 text-[var(--foreground)]">{member.displayName || member.username}</span>
                  <span className="font-mono text-xs text-[var(--muted)]">{member.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
