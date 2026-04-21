import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { UserRound } from 'lucide-react'

type BotProfile = {
  id: string
  username: string
  tag: string
  globalName: string | null
  bio: string
  avatarUrl: string
  bannerUrl: string | null
  presenceStatus: string
  activityName: string
  activityState: string
  activityType: number
  presenceActivityLocked?: boolean
  memberCount?: number | null
}

const PRESENCE_OPTS: { value: string; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'idle', label: 'Abwesend' },
  { value: 'dnd', label: 'Bitte nicht stören' },
  { value: 'invisible', label: 'Unsichtbar' },
]

const ACTIVITY_TYPE_OPTS: { value: number; label: string }[] = [
  { value: 0, label: 'Spielt' },
  { value: 1, label: 'Streamt' },
  { value: 2, label: 'Hört zu' },
  { value: 3, label: 'Schaut' },
  { value: 4, label: 'Custom Status' },
  { value: 5, label: 'Wettet um' },
]

const MAX_FILE_READ = 2_400_000

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_READ) {
      reject(new Error('Bild zu groß (max. ca. 2,3 MB).'))
      return
    }
    const r = new FileReader()
    r.onload = () => {
      if (typeof r.result === 'string') resolve(r.result)
      else reject(new Error('Lesen fehlgeschlagen'))
    }
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    r.readAsDataURL(file)
  })
}

export function BotProfilePanel({ botOnline }: { botOnline: boolean }) {
  const [profile, setProfile] = useState<BotProfile | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarB64, setAvatarB64] = useState<string | null>(null)
  const [bannerB64, setBannerB64] = useState<string | null>(null)
  const [clearAvatar, setClearAvatar] = useState(false)
  const [clearBanner, setClearBanner] = useState(false)
  const [presenceStatus, setPresenceStatus] = useState('online')
  const [activityName, setActivityName] = useState('')
  const [activityState, setActivityState] = useState('')
  const [activityType, setActivityType] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const r = await fetch(apiUrl('/api/bot/profile'), { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) {
        setLoadErr('Nicht angemeldet.')
        return
      }
      if (!r.ok) {
        setLoadErr(j.error || `Fehler ${r.status}`)
        return
      }
      const p = j as BotProfile
      setProfile(p)
      setUsername(p.username || '')
      setBio(typeof p.bio === 'string' ? p.bio : '')
      setPresenceStatus(p.presenceStatus || 'online')
      setActivityName(typeof p.activityName === 'string' ? p.activityName : '')
      setActivityState(typeof p.activityState === 'string' ? p.activityState : '')
      setActivityType(typeof p.activityType === 'number' ? p.activityType : 0)
      setAvatarB64(null)
      setBannerB64(null)
      setClearAvatar(false)
      setClearBanner(false)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    }
  }, [])

  useEffect(() => {
    if (botOnline) void load()
  }, [botOnline, load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (profile && username.trim() !== profile.username) {
        body.username = username.trim()
      }
      if (bio !== (profile?.bio ?? '')) {
        body.bio = bio
      }
      if (clearAvatar) body.clearAvatar = true
      else if (avatarB64) body.avatarBase64 = avatarB64
      if (clearBanner) body.clearBanner = true
      else if (bannerB64) body.bannerBase64 = bannerB64

      if (profile) {
        if (presenceStatus !== profile.presenceStatus) {
          body.presenceStatus = presenceStatus
        }
        if (!profile.presenceActivityLocked) {
          const curAct = profile.activityName ?? ''
          const curSt = profile.activityState ?? ''
          const nextAct = activityName.trim()
          const nextSt = activityState.trim()
          if (nextAct !== curAct || nextSt !== curSt || activityType !== profile.activityType) {
            body.activityName = nextAct
            body.activityState = nextSt
            body.activityType = activityType
          }
        }
      }

      if (Object.keys(body).length === 0) {
        setMsg('Keine Änderungen.')
        return
      }

      const r = await fetch(apiUrl('/api/bot/profile'), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) {
        setMsg('Nicht angemeldet.')
        return
      }
      if (!r.ok) {
        setMsg(j.error || `Fehler ${r.status}`)
        return
      }
      const p = j as BotProfile
      setProfile(p)
      setUsername(p.username || '')
      setBio(typeof p.bio === 'string' ? p.bio : '')
      setPresenceStatus(p.presenceStatus || 'online')
      setActivityName(typeof p.activityName === 'string' ? p.activityName : '')
      setActivityState(typeof p.activityState === 'string' ? p.activityState : '')
      setActivityType(typeof p.activityType === 'number' ? p.activityType : 0)
      setAvatarB64(null)
      setBannerB64(null)
      setClearAvatar(false)
      setClearBanner(false)
      setMsg('Gespeichert.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dash-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserRound className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-bold text-white">Erscheinungsbild</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        <strong className="text-zinc-300">Bio</strong> = Text im Profil („Über mich“).{' '}
        <strong className="text-zinc-300">Aktivität</strong> = zwei getrennte Zeilen: Haupttext (z. B. „Spielt …“) und
        optionale Zusatzzeile — unabhängig von der Bio. Avatar/Banner/Bio kann Discord ablehnen.
      </p>

      {!botOnline && (
        <p className="text-sm text-zinc-500">Profil laden, sobald der Bot online ist…</p>
      )}

      {loadErr && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadErr}
        </p>
      )}

      {profile && botOnline && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border border-[var(--border)] bg-black/30 object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-xs text-[var(--muted)]">{profile.tag}</p>
              <label className="block text-xs font-semibold text-zinc-400">Benutzername</label>
              <input
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                maxLength={32}
                className="dash-input w-full max-w-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">
              Bio / „Über mich“ <span className="font-normal text-zinc-500">(Profil — nicht die Aktivität)</span>
            </label>
            <textarea
              value={bio}
              onChange={(ev) => setBio(ev.target.value.slice(0, 190))}
              rows={4}
              placeholder="Kurzbeschreibung…"
              className="dash-input mt-1 max-w-xl min-h-[5.5rem] resize-y"
            />
            <p className="mt-1 text-[10px] text-[var(--muted)]">{bio.length}/190</p>
          </div>

          <div className="dash-panel border-[var(--border)] bg-black/15 p-4">
            <p className="mb-3 text-xs font-semibold text-zinc-300">Discord-Status &amp; Aktivität</p>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <select
                value={presenceStatus}
                onChange={(ev) => setPresenceStatus(ev.target.value)}
                aria-label="Discord-Status (Punktfarbe)"
                className="dash-input w-full shrink-0 sm:w-[11rem]"
              >
                {PRESENCE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!profile.presenceActivityLocked ? (
                <select
                  value={activityType}
                  onChange={(ev) => setActivityType(Number(ev.target.value))}
                  aria-label="Aktivitätstyp (Spielt, Schaut …)"
                  className="dash-input w-full shrink-0 sm:w-[11rem]"
                >
                  {ACTIVITY_TYPE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {profile.presenceActivityLocked ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/95">
                <p>
                  Aktivität ist <strong>automatisch</strong>: im Client als{' '}
                  <strong>Watching {profile.memberCount ?? '…'} members</strong> (DE oft: „Schaut … zu“). Aktualisiert
                  sich bei Join/Leave.
                </p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  Zum manuellen Text: <code className="rounded bg-black/30 px-1">BOT_PRESENCE_MEMBER_COUNT=false</code>{' '}
                  in <code className="rounded bg-black/30 px-1">.env</code>, Bot neu starten.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-400">
                    Aktivität — Haupttext{' '}
                    <span className="font-normal text-zinc-500">(z. B. „Test“ bei „Spielt“)</span>
                  </label>
                  <input
                    value={activityName}
                    onChange={(ev) => setActivityName(ev.target.value.slice(0, 128))}
                    placeholder="Leer lassen = keine Aktivität anzeigen"
                    className="dash-input mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400">
                    Aktivität — Zusatzzeile{' '}
                    <span className="font-normal text-zinc-500">(optional, zweite Zeile in manchen Clients)</span>
                  </label>
                  <input
                    value={activityState}
                    onChange={(ev) => setActivityState(ev.target.value.slice(0, 128))}
                    placeholder="Optional — nur sinnvoll mit Haupttext"
                    className="dash-input mt-1 w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-400">Neues Avatar-Bild</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="mt-1 w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-white"
                onChange={async (ev) => {
                  const f = ev.target.files?.[0]
                  if (!f) return
                  try {
                    setAvatarB64(await readFileAsDataUrl(f))
                    setClearAvatar(false)
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Avatar-Fehler')
                  }
                }}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={clearAvatar}
                  onChange={(ev) => {
                    setClearAvatar(ev.target.checked)
                    if (ev.target.checked) setAvatarB64(null)
                  }}
                />
                Avatar entfernen
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">Neues Banner-Bild</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="mt-1 w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-white"
                onChange={async (ev) => {
                  const f = ev.target.files?.[0]
                  if (!f) return
                  try {
                    setBannerB64(await readFileAsDataUrl(f))
                    setClearBanner(false)
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Banner-Fehler')
                  }
                }}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={clearBanner}
                  onChange={(ev) => {
                    setClearBanner(ev.target.checked)
                    if (ev.target.checked) setBannerB64(null)
                  }}
                />
                Banner entfernen
              </label>
            </div>
          </div>

          {msg && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                msg === 'Gespeichert.'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border border-amber-500/25 bg-amber-500/10 text-amber-100'
              }`}
            >
              {msg}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="dash-btn dash-btn-accent px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button type="button" onClick={() => void load()} className="dash-btn px-4 py-2 text-sm">
              Zurücksetzen
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
