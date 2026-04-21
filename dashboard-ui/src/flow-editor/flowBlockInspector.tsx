import type { Node } from '@xyflow/react'

/** Hinweis für Textfelder mit Platzhaltern */
const PLACEHOLDER_HINT = (
  <p className="mt-2 text-[10px] leading-snug text-zinc-600">
    Platzhalter: {'{user}'}, {'{user.mention}'}, {'{channel}'}, {'{server}'}, {'{server.id}'},{' '}
    {'{option:name}'}, {'{var:schlüssel}'}, {'{target}'} …
  </p>
)

type RoleOpt = { id: string; name: string; color: string | null }

const PERMISSION_OPTIONS = [
  'Administrator',
  'ManageGuild',
  'ManageChannels',
  'ManageRoles',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
  'ManageMessages',
  'ManageNicknames',
  'ManageWebhooks',
  'MentionEveryone',
  'SendMessages',
  'ViewChannel',
  'AttachFiles',
  'EmbedLinks',
  'ReadMessageHistory',
  'UseExternalEmojis',
  'Connect',
  'Speak',
  'MuteMembers',
  'DeafenMembers',
  'MoveMembers',
] as const

export function FlowBlockInspector({
  node,
  roles,
  rolesErr,
  guildId,
  onPatch,
}: {
  node: Node
  roles: RoleOpt[]
  rolesErr: string | null
  guildId: string
  onPatch: (p: Record<string, unknown>) => void
}) {
  const d = (node.data || {}) as Record<string, unknown>
  const roleSelect = (
    <label className="mt-2 block">
      <span className="text-xs text-zinc-500">Rolle</span>
      {!guildId ? (
        <p className="mt-1 text-xs text-amber-400/90">Server im Header wählen.</p>
      ) : rolesErr ? (
        <p className="mt-1 text-xs text-red-300/90">{rolesErr}</p>
      ) : (
        <select
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
          value={String(d.roleId || '')}
          onChange={(e) => onPatch({ roleId: e.target.value })}
        >
          <option value="">— wählen —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </label>
  )

  switch (node.type) {
    case 'trigger_slash':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Command-Name (ohne /)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.commandName ?? '')}
              onChange={(e) =>
                onPatch({ commandName: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })
              }
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Beschreibung (Slash)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.commandDescription ?? '')}
              onChange={(e) => onPatch({ commandDescription: e.target.value.slice(0, 100) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Slash-Optionen (JSON-Array)</span>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-xs"
              spellCheck={false}
              value={String(d.slashOptionsJson ?? '[]')}
              onChange={(e) => onPatch({ slashOptionsJson: e.target.value.slice(0, 8000) })}
            />
            <span className="mt-1 block text-[10px] text-zinc-600">
              z. B. [{' '}
              <code className="text-zinc-400">
                {`{"name":"grund","type":"string","description":"Text","required":true}`}
              </code>
              ] — Typen: string, integer, number, boolean, user, channel, role. Name ≠ ziel (Ziel-User).
            </span>
          </label>
        </div>
      )
    case 'action_reply_text':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Text</span>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.content ?? '')}
              onChange={(e) => onPatch({ content: e.target.value.slice(0, 2000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(d.ephemeral)}
              onChange={(e) => onPatch({ ephemeral: e.target.checked })}
            />
            <span className="text-sm">Ephemeral</span>
          </label>
        </div>
      )
    case 'action_reply_embed':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Titel</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.title ?? '')}
              onChange={(e) => onPatch({ title: e.target.value.slice(0, 256) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Beschreibung</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.description ?? '')}
              onChange={(e) => onPatch({ description: e.target.value.slice(0, 4000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="block">
            <span className="text-xs text-zinc-500">Farbe (#hex)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.color ?? '#5865F2')}
              onChange={(e) => onPatch({ color: e.target.value.slice(0, 7) })}
            />
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(d.ephemeral)}
              onChange={(e) => onPatch({ ephemeral: e.target.checked })}
            />
            <span className="text-sm">Ephemeral</span>
          </label>
        </div>
      )
    case 'action_kick':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Grund</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.reason ?? '')}
            onChange={(e) => onPatch({ reason: e.target.value.slice(0, 400) })}
          />
          {PLACEHOLDER_HINT}
        </label>
      )
    case 'action_ban':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Grund</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.reason ?? '')}
              onChange={(e) => onPatch({ reason: e.target.value.slice(0, 400) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="block">
            <span className="text-xs text-zinc-500">Nachrichten löschen (Tage 0–7)</span>
            <input
              type="number"
              min={0}
              max={7}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.deleteMessageDays ?? 0)}
              onChange={(e) =>
                onPatch({ deleteMessageDays: Math.min(7, Math.max(0, Number(e.target.value) || 0)) })
              }
            />
          </label>
        </div>
      )
    case 'action_timeout':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Dauer (Minuten)</span>
            <input
              type="number"
              min={1}
              max={40320}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.minutes ?? 10)}
              onChange={(e) =>
                onPatch({ minutes: Math.min(40320, Math.max(1, Math.floor(Number(e.target.value) || 10))) })
              }
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Grund (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.reason ?? '')}
              onChange={(e) => onPatch({ reason: e.target.value.slice(0, 400) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'action_role_add':
    case 'action_role_remove':
    case 'bg_role_add_all':
    case 'bg_role_remove_all':
    case 'bg_role_delete':
    case 'bg_role_edit':
      return (
        <div>
          {roleSelect}
          {node.type === 'bg_role_edit' ? (
            <>
              <label className="mt-2 block">
                <span className="text-xs text-zinc-500">Neuer Name (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
                  value={String(d.newName ?? '')}
                  onChange={(e) => onPatch({ newName: e.target.value.slice(0, 100) })}
                />
              </label>
              <label className="mt-2 block">
                <span className="text-xs text-zinc-500">Neue Farbe (#hex, optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
                  value={String(d.newColor ?? '')}
                  onChange={(e) => onPatch({ newColor: e.target.value.slice(0, 7) })}
                />
              </label>
            </>
          ) : null}
        </div>
      )
    case 'bg_role_create':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Rollenname</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.roleName ?? '')}
              onChange={(e) => onPatch({ roleName: e.target.value.slice(0, 100) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="block">
            <span className="text-xs text-zinc-500">Farbe (hex ohne #)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.color ?? '')}
              onChange={(e) => onPatch({ color: e.target.value.slice(0, 6) })}
            />
          </label>
        </div>
      )
    case 'logic_condition':
    case 'cond_role':
      return (
        <div>
          <p className="text-xs text-zinc-500">Wenn der Nutzer (Ziel oder ausführend) die Rolle hat → „wahr“.</p>
          {roleSelect}
        </div>
      )
    case 'logic_error_handler':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Hinweis bei Fehler (ephemeral)</span>
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.message ?? '')}
            onChange={(e) => onPatch({ message: e.target.value.slice(0, 500) })}
          />
          {PLACEHOLDER_HINT}
        </label>
      )
    case 'bg_msg_send_or_edit':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Ziel</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
              value={String(d.target ?? 'reply')}
              onChange={(e) => onPatch({ target: e.target.value })}
            >
              <option value="reply">Antwort / Interaction</option>
              <option value="channel">Kanal</option>
              <option value="dm">DM</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Text</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.content ?? '')}
              onChange={(e) => onPatch({ content: e.target.value.slice(0, 2000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(d.ephemeral)}
              onChange={(e) => onPatch({ ephemeral: e.target.checked })}
            />
            <span className="text-sm">Ephemeral (nur bei reply)</span>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Embed-Titel (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.embedTitle ?? '')}
              onChange={(e) => onPatch({ embedTitle: e.target.value.slice(0, 256) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Embed-Beschreibung (optional)</span>
            <textarea
              className="mt-1 min-h-[60px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.embedDescription ?? '')}
              onChange={(e) => onPatch({ embedDescription: e.target.value.slice(0, 4000) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Embed-Farbe (#hex)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.embedColor ?? '#5865F2')}
              onChange={(e) => onPatch({ embedColor: e.target.value.slice(0, 7) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (bei Ziel Kanal)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">User-ID (bei DM)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.userId ?? '')}
              onChange={(e) => onPatch({ userId: e.target.value })}
            />
          </label>
        </div>
      )
    case 'bg_msg_edit_components':
      return (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Erweiterte Nutzung: Kanal- und Nachrichten-ID.</p>
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Nachrichten-ID</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.messageId ?? '')}
              onChange={(e) => onPatch({ messageId: e.target.value })}
            />
          </label>
        </div>
      )
    case 'bg_msg_send_form':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Modal-Titel</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.modalTitle ?? '')}
              onChange={(e) => onPatch({ modalTitle: e.target.value.slice(0, 45) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Feld-Label</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.field1Label ?? '')}
              onChange={(e) => onPatch({ field1Label: e.target.value.slice(0, 45) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'bg_msg_delete':
    case 'bg_msg_publish':
    case 'bg_msg_react':
    case 'bg_msg_pin':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (leer = aktuell)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Nachrichten-ID (leer = Bot-Antwort bei Löschen)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.messageId ?? '')}
              onChange={(e) => onPatch({ messageId: e.target.value })}
            />
          </label>
          {node.type === 'bg_msg_react' ? (
            <label className="block">
              <span className="text-xs text-zinc-500">Emoji</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
                value={String(d.emoji ?? '')}
                onChange={(e) => onPatch({ emoji: e.target.value.slice(0, 64) })}
              />
              {PLACEHOLDER_HINT}
            </label>
          ) : null}
        </div>
      )
    case 'bg_msg_transcript':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (leer = aktuell)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Limit (1–1000)</span>
            <input
              type="number"
              min={1}
              max={1000}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.limit ?? 50)}
              onChange={(e) =>
                onPatch({ limit: Math.min(1000, Math.max(1, Math.floor(Number(e.target.value) || 50))) })
              }
            />
          </label>
        </div>
      )
    case 'bg_var_set':
    case 'bg_other_unique_var':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Schlüssel</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.key ?? '')}
              onChange={(e) => onPatch({ key: e.target.value.slice(0, 64) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Wert</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.value ?? '')}
              onChange={(e) => onPatch({ value: e.target.value.slice(0, 4000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'bg_var_equation':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Variable (Schlüssel)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.key ?? '')}
              onChange={(e) => onPatch({ key: e.target.value.slice(0, 64) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Operation</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
              value={String(d.operation ?? 'add')}
              onChange={(e) => onPatch({ operation: e.target.value })}
            >
              <option value="add">+ add</option>
              <option value="subtract">− subtract</option>
              <option value="multiply">× multiply</option>
              <option value="divide">÷ divide</option>
              <option value="set">= set</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Operand (Zahl)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.operand ?? '')}
              onChange={(e) => onPatch({ operand: e.target.value.slice(0, 32) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'bg_var_delete':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Schlüssel</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
            value={String(d.key ?? '')}
            onChange={(e) => onPatch({ key: e.target.value.slice(0, 64) })}
          />
        </label>
      )
    case 'bg_loop_run':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Wiederholungen (1–50, nächster Block im Pfad)</span>
          <input
            type="number"
            min={1}
            max={50}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={Number(d.times ?? 1)}
            onChange={(e) =>
              onPatch({ times: Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1))) })
            }
          />
        </label>
      )
    case 'bg_loop_stop':
      return <p className="text-xs text-zinc-500">Keine Einstellungen (Marker).</p>
    case 'bg_note':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Notiz (nur Editor)</span>
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.note ?? '')}
            onChange={(e) => onPatch({ note: e.target.value.slice(0, 2000) })}
          />
        </label>
      )
    case 'bg_helper_text':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Hilfstext (wird im Flow nicht ausgeführt)</span>
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.text ?? '')}
            onChange={(e) => onPatch({ text: e.target.value.slice(0, 2000) })}
          />
        </label>
      )
    case 'bg_voice_join':
    case 'bg_voice_move':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Voice-Kanal-ID</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
            value={String(d.channelId ?? '')}
            onChange={(e) => onPatch({ channelId: e.target.value })}
          />
        </label>
      )
    case 'bg_voice_leave':
    case 'bg_voice_disconnect':
    case 'bg_voice_kick':
      return <p className="text-xs text-zinc-500">Keine Einstellungen (Ziel: Slash-Option „ziel“).</p>
    case 'bg_voice_mute':
    case 'bg_voice_deafen':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Modus</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
            value={String(d.mode ?? 'true')}
            onChange={(e) => onPatch({ mode: e.target.value })}
          >
            <option value="true">An</option>
            <option value="false">Aus</option>
          </select>
        </label>
      )
    case 'bg_channel_create':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.channelName ?? '')}
              onChange={(e) => onPatch({ channelName: e.target.value.slice(0, 100) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="block">
            <span className="text-xs text-zinc-500">Typ</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
              value={String(d.channelType ?? 'text')}
              onChange={(e) => onPatch({ channelType: e.target.value })}
            >
              <option value="text">Text</option>
              <option value="voice">Voice</option>
              <option value="category">Kategorie</option>
            </select>
          </label>
        </div>
      )
    case 'bg_channel_edit':
    case 'bg_channel_delete':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          {node.type === 'bg_channel_edit' ? (
            <label className="block">
              <span className="text-xs text-zinc-500">Neuer Name</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
                value={String(d.newName ?? '')}
                onChange={(e) => onPatch({ newName: e.target.value.slice(0, 100) })}
              />
            </label>
          ) : null}
        </div>
      )
    case 'bg_thread_create':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (Parent, leer = aktuell)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Thread-Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.threadName ?? '')}
              onChange={(e) => onPatch({ threadName: e.target.value.slice(0, 100) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Thread-ID → Variable (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.outputThreadVar ?? '')}
              onChange={(e) => onPatch({ outputThreadVar: e.target.value.slice(0, 64) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'bg_thread_edit':
    case 'bg_thread_delete':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Thread-ID</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.threadId ?? '')}
              onChange={(e) => onPatch({ threadId: e.target.value })}
            />
          </label>
          {node.type === 'bg_thread_edit' ? (
            <label className="block">
              <span className="text-xs text-zinc-500">Neuer Name</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
                value={String(d.newName ?? '')}
                onChange={(e) => onPatch({ newName: e.target.value.slice(0, 100) })}
              />
            </label>
          ) : null}
        </div>
      )
    case 'bg_server_nickname':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Nickname (leer = zurücksetzen)</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.nickname ?? '')}
            onChange={(e) => onPatch({ nickname: e.target.value.slice(0, 32) })}
          />
          {PLACEHOLDER_HINT}
        </label>
      )
    case 'bg_server_purge':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (leer = aktuell)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Anzahl (1–100)</span>
            <input
              type="number"
              min={1}
              max={100}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.amount ?? 10)}
              onChange={(e) =>
                onPatch({ amount: Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 10))) })
              }
            />
          </label>
        </div>
      )
    case 'bg_server_leave':
      return (
        <div className="space-y-3">
          <p className="text-xs text-amber-400/90">Gefährlich: Bot verlässt den Server.</p>
          <label className="block">
            <span className="text-xs text-zinc-500">Bestätigung (exakt: LEAVE)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.confirm ?? '')}
              onChange={(e) => onPatch({ confirm: e.target.value })}
            />
          </label>
        </div>
      )
    case 'bg_server_invite':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Kanal-ID (leer = aktuell)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.channelId ?? '')}
              onChange={(e) => onPatch({ channelId: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">maxAge (Sekunden)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.maxAge ?? 3600)}
              onChange={(e) => onPatch({ maxAge: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">maxUses (0 = unbegrenzt)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={Number(d.maxUses ?? 0)}
              onChange={(e) => onPatch({ maxUses: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </label>
        </div>
      )
    case 'bg_other_wait':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Millisekunden (max. 60000)</span>
          <input
            type="number"
            min={0}
            max={60000}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={Number(d.milliseconds ?? 1000)}
            onChange={(e) =>
              onPatch({
                milliseconds: Math.min(60000, Math.max(0, Math.floor(Number(e.target.value) || 0))),
              })
            }
          />
        </label>
      )
    case 'bg_other_manipulate_text':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Eingabetext</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.input ?? '')}
              onChange={(e) => onPatch({ input: e.target.value.slice(0, 4000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
          <label className="block">
            <span className="text-xs text-zinc-500">Operation</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
              value={String(d.operation ?? 'upper')}
              onChange={(e) => onPatch({ operation: e.target.value })}
            >
              <option value="upper">GROSS</option>
              <option value="lower">klein</option>
              <option value="trim">trim</option>
              <option value="length">Länge</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Ausgabe-Variable</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.outputKey ?? '')}
              onChange={(e) => onPatch({ outputKey: e.target.value.slice(0, 64) })}
            />
          </label>
        </div>
      )
    case 'bg_other_error_log':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Nachricht</span>
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={String(d.message ?? '')}
            onChange={(e) => onPatch({ message: e.target.value.slice(0, 500) })}
          />
          {PLACEHOLDER_HINT}
        </label>
      )
    case 'bg_other_bot_status':
      return (
        <p className="text-xs text-amber-400/90">
          Legacy-Block: wird bei der Ausführung übersprungen (Multi-Server; siehe Konsole).
        </p>
      )
    case 'cond_comparison':
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Links</span>
            <textarea
              className="mt-1 min-h-[48px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.left ?? '')}
              onChange={(e) => onPatch({ left: e.target.value.slice(0, 2000) })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Operator</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
              value={String(d.operator ?? 'eq')}
              onChange={(e) => onPatch({ operator: e.target.value })}
            >
              <option value="eq">gleich</option>
              <option value="neq">ungleich</option>
              <option value="contains">enthält</option>
              <option value="starts">beginnt mit</option>
              <option value="ends">endet mit</option>
              <option value="lt">&lt; (Zahl)</option>
              <option value="gt">&gt; (Zahl)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Rechts</span>
            <textarea
              className="mt-1 min-h-[48px] w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
              value={String(d.right ?? '')}
              onChange={(e) => onPatch({ right: e.target.value.slice(0, 2000) })}
            />
          </label>
          {PLACEHOLDER_HINT}
        </div>
      )
    case 'cond_permission':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Berechtigung (Ausführender)</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
            value={String(d.permission ?? 'Administrator')}
            onChange={(e) => onPatch({ permission: e.target.value })}
          >
            {PERMISSION_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )
    case 'cond_chance':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Wahrscheinlichkeit wahr (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm"
            value={Number(d.percent ?? 50)}
            onChange={(e) =>
              onPatch({ percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
            }
          />
        </label>
      )
    case 'cond_channel':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Kanal-ID (muss Slash-Kanal sein)</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
            value={String(d.channelId ?? '')}
            onChange={(e) => onPatch({ channelId: e.target.value })}
          />
        </label>
      )
    case 'cond_user':
      return (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-zinc-500">User-ID (leer = Ziel-Slash-Option)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 font-mono text-sm"
              value={String(d.userId ?? '')}
              onChange={(e) => onPatch({ userId: e.target.value })}
            />
          </label>
          <p className="text-[10px] text-zinc-600">Benötigt oft Slash-Option „ziel“.</p>
        </div>
      )
    case 'cond_premium':
      return (
        <label className="block">
          <span className="text-xs text-zinc-500">Erwarte Premium (env BOT_PREMIUM_MODE)</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-2 py-2 text-sm text-zinc-200"
            value={String(d.expectPremium ?? 'true')}
            onChange={(e) => onPatch({ expectPremium: e.target.value })}
          >
            <option value="true">Server soll „Premium“ sein</option>
            <option value="false">Server soll nicht „Premium“ sein</option>
          </select>
        </label>
      )
    default:
      return <p className="text-zinc-500">Keine Einstellungen für diesen Blocktyp.</p>
  }
}
