import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import type { Snapshot } from '@/hooks/useSnapshot'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'
import {
  CustomCommandFlowEditor,
  type SerializedFlow,
} from '@/flow-editor/CustomCommandFlowEditor'
import type { Node, Edge } from '@xyflow/react'
import { Pencil, Plus, Trash2, Workflow } from 'lucide-react'

function countLabel(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

type ApiFlow = {
  name: string
  description: string
  nodes: Node[]
  edges: Edge[]
}

/** Stellt sicher, dass Trigger-Daten mit Root name/description übereinstimmen. */
function normalizeFlowForEditor(f: ApiFlow): SerializedFlow {
  const nodes = (f.nodes || []).map((n) => ({ ...n, data: { ...(n.data as object) } }))
  const trigger = nodes.find((n) => n.type === 'trigger_slash')
  if (trigger) {
    const d = (trigger.data || {}) as Record<string, unknown>
    trigger.data = {
      ...d,
      commandName: String(d.commandName || f.name || '').toLowerCase(),
      commandDescription: String(d.commandDescription ?? f.description ?? ''),
    }
  }
  const edges = (f.edges || []).map((e, i) => ({
    ...e,
    id: e.id || `e-${i}-${e.source}-${e.target}`,
  }))
  return {
    name: f.name,
    description: f.description || '',
    nodes,
    edges,
  }
}

export function CommandsPage({
  data,
  serverScope,
  selectedGuildId,
}: {
  data: Snapshot | null
  serverScope: DashboardServerScope
  selectedGuildId: string
}) {
  const [apiFlows, setApiFlows] = useState<ApiFlow[]>([])
  const [flowsLoadErr, setFlowsLoadErr] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorInitial, setEditorInitial] = useState<SerializedFlow | null>(null)
  const [openedAsName, setOpenedAsName] = useState<string | null>(null)

  const reloadFlows = useCallback(async () => {
    if (!selectedGuildId) {
      setApiFlows([])
      setFlowsLoadErr(null)
      return
    }
    try {
      const r = await fetch(apiUrl(`/api/custom-commands?guildId=${encodeURIComponent(selectedGuildId)}`), {
        credentials: 'include',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setApiFlows(Array.isArray(j.flows) ? j.flows : [])
      setFlowsLoadErr(null)
    } catch (e) {
      setFlowsLoadErr(e instanceof Error ? e.message : 'Flows konnten nicht geladen werden.')
      setApiFlows([])
    }
  }, [selectedGuildId])

  useEffect(() => {
    void reloadFlows()
  }, [reloadFlows])

  const openNew = () => {
    setEditorInitial(null)
    setOpenedAsName(null)
    setEditorOpen(true)
  }

  const openEdit = (f: ApiFlow) => {
    setEditorInitial(normalizeFlowForEditor(f))
    setOpenedAsName(f.name)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditorInitial(null)
    setOpenedAsName(null)
  }

  const deleteFlow = async (name: string) => {
    if (!selectedGuildId) return
    if (!window.confirm(`Flow-Command „/${name}“ auf diesem Server wirklich löschen?`)) return
    try {
      const r = await fetch(
        apiUrl(
          `/api/custom-commands/${encodeURIComponent(selectedGuildId)}/${encodeURIComponent(name)}`
        ),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await reloadFlows()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  if (!data) {
    return (
      <div className="dash-page-shell-md">
        <ServerScopeBanner scope={serverScope} />
        <p className="text-sm text-[var(--muted)]">Lade Befehle…</p>
      </div>
    )
  }

  const slashN = data.commands.length
  const btnN = data.buttons.length
  const summary = [
    countLabel(slashN, 'Slash-Befehl', 'Slash-Befehle'),
    countLabel(btnN, 'Button-Aktion', 'Button-Aktionen'),
  ].join(' · ')

  const builtinCommands = data.commands.filter((c) => !c.custom)

  const flowUsage = (cmdName: string) =>
    selectedGuildId
      ? (data.usage[`flow:${selectedGuildId}:${cmdName.toLowerCase()}`] ?? data.usage[cmdName] ?? 0)
      : 0

  return (
    <div className="dash-page-shell-md">
      <ServerScopeBanner scope={serverScope} />

      {editorOpen ? (
        <CustomCommandFlowEditor
          initialFlow={editorInitial}
          openedAsName={openedAsName}
          guildId={selectedGuildId}
          onClose={closeEditor}
          onSaved={() => void reloadFlows()}
        />
      ) : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="dash-page-title">Befehle &amp; Aktionen</h1>
          <p className="dash-page-desc">
            {summary} — Nutzungszähler seit Bot-Start gelten bot-weit; sichtbare Befehle können je gewähltem Server
            ausgeblendet sein (z. B. send_server).
          </p>
        </div>
        <button
          type="button"
          className="dash-btn dash-btn-accent flex items-center gap-2 self-start px-4 py-2.5 font-semibold disabled:opacity-50"
          disabled={!selectedGuildId}
          onClick={openNew}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Neuer Flow-Command
        </button>
      </header>

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-violet-400" aria-hidden />
            <h2 className="text-base font-semibold text-zinc-100">Eigene Flow-Commands</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Gilt nur für den oben gewählten Server — andere Communities sehen diese Befehle nicht.
          </p>
        </div>
        {flowsLoadErr ? <p className="mb-2 text-sm text-red-300/90">{flowsLoadErr}</p> : null}
        {!selectedGuildId ? (
          <p className="text-sm text-amber-400/90">Bitte zuerst einen Server in der Kopfzeile auswählen.</p>
        ) : apiFlows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Noch keine Flows für diesen Server. Mit „Neuer Flow-Command“ anlegen — Speicherung unter{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">data/custom-commands/&lt;Server-ID&gt;/</code>.
          </p>
        ) : (
          <div className="dash-panel divide-y divide-[var(--border)]">
            {apiFlows.map((f) => (
              <div
                key={f.name}
                className="dash-list-row-hover flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-violet-300">/{f.name}</span>
                    <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200/90">
                      Flow
                    </span>
                  </div>
                  {f.description ? <p className="mt-1 text-sm text-zinc-500">{f.description}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span className="tabular-nums text-sm text-zinc-400">
                    {flowUsage(f.name)}{' '}
                    <span className="text-xs font-normal text-zinc-600">Nutzungen</span>
                  </span>
                  <button type="button" className="dash-btn flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => openEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Command bearbeiten
                  </button>
                  <button
                    type="button"
                    className="dash-btn dash-btn-danger flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    onClick={() => void deleteFlow(f.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Eingebaute Slash-Befehle</h2>
        <div className="dash-panel divide-y divide-[var(--border)]">
          {builtinCommands.map((c) => (
            <div
              key={c.name}
              className="dash-list-row-hover flex flex-col gap-2 px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-[var(--accent)]">/{c.name}</span>
                  <span className="rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Slash
                  </span>
                </div>
                {c.description ? <p className="mt-1 text-sm text-zinc-500">{c.description}</p> : null}
              </div>
              <div className="shrink-0 tabular-nums text-sm font-medium text-zinc-400 sm:text-right">
                {data.usage[c.name] ?? 0}{' '}
                <span className="text-xs font-normal text-zinc-600">Nutzungen</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Button-Aktionen</h2>
        <div className="dash-panel divide-y divide-[var(--border)]">
          {data.buttons.map((b) => (
            <div
              key={b.usageKey}
              className="dash-list-row-hover flex flex-col gap-2 px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{b.label}</span>
                  <span className="rounded-md border border-pink-500/20 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-300/90">
                    Button
                  </span>
                </div>
                {b.description ? <p className="mt-1 text-sm text-zinc-500">{b.description}</p> : null}
              </div>
              <div className="shrink-0 tabular-nums text-sm font-medium text-zinc-400 sm:text-right">
                {data.usage[b.usageKey] ?? 0}{' '}
                <span className="text-xs font-normal text-zinc-600">Nutzungen</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
