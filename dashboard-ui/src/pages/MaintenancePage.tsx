import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

type MaintenanceState = {
  enabled: boolean
  text: string
}

export function MaintenancePage({
  current,
  onChanged,
}: {
  current: MaintenanceState | null
  onChanged: (next: MaintenanceState) => void
}) {
  const [enabled, setEnabled] = useState(Boolean(current?.enabled))
  const [text, setText] = useState(current?.text || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(Boolean(current?.enabled))
    setText(current?.text || '')
  }, [current?.enabled, current?.text])

  async function saveState(nextEnabled: boolean, nextText: string, okMsg = 'Gespeichert.') {
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(apiUrl('/api/system/maintenance'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled, text: nextText.trim().slice(0, 240) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(typeof j.error === 'string' ? j.error : `Fehler ${r.status}`)
        return
      }
      const next = {
        enabled: Boolean(j?.maintenance?.enabled),
        text: typeof j?.maintenance?.text === 'string' ? j.maintenance.text : '',
      }
      onChanged(next)
      setEnabled(next.enabled)
      setText(next.text)
      setMsg(okMsg)
    } catch {
      setMsg('Netzwerkfehler.')
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    await saveState(enabled, text, 'Gespeichert.')
  }

  async function applyPreset(preset: string) {
    const presetText = preset.trim().slice(0, 240)
    setEnabled(true)
    setText(presetText)
    await saveState(true, presetText, 'Wartungshinweis aktiviert.')
  }

  async function disableMaintenance() {
    await saveState(false, '', 'Wartungshinweis deaktiviert.')
  }

  return (
    <div className="dash-page-shell-xs">
      <div>
        <h1 className="dash-page-title">Wartung</h1>
        <p className="dash-page-desc">Hinweis-Banner oben für alle Dashboard-Nutzer steuern.</p>
      </div>

      <div className="dash-panel space-y-4 p-5">
        <div className="space-y-2">
          <p className="dash-label">Schnelltexte (1 Klick)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dash-btn px-3 text-xs"
              disabled={saving}
              onClick={() => void applyPreset('Wartungsarbeiten laufen gerade. Einige Funktionen können kurz eingeschränkt sein.')}
            >
              Allgemeine Wartung
            </button>
            <button
              type="button"
              className="dash-btn px-3 text-xs"
              disabled={saving}
              onClick={() => void applyPreset('Update wird eingespielt. Dashboard und Bot können kurz neu verbinden.')}
            >
              Update wird eingespielt
            </button>
            <button
              type="button"
              className="dash-btn px-3 text-xs"
              disabled={saving}
              onClick={() => void applyPreset('Kurze Wartung: Änderungen dauern bis zu 1 Minute, bis sie überall sichtbar sind.')}
            >
              Kurze Wartung
            </button>
            <button
              type="button"
              className="dash-btn dash-btn-danger px-3 text-xs"
              disabled={saving}
              onClick={() => void disableMaintenance()}
            >
              Wartung aus
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Wartungshinweis aktiv
        </label>
        <label className="block">
          <span className="dash-label">Text (max. 240 Zeichen)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 240))}
            rows={3}
            className="dash-input mt-1 w-full"
            placeholder="Kurzer Wartungshinweis..."
          />
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className="dash-btn dash-btn-accent px-4" disabled={saving} onClick={() => void save()}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
          {msg ? <span className="text-sm text-[var(--muted)]">{msg}</span> : null}
        </div>
      </div>
    </div>
  )
}
