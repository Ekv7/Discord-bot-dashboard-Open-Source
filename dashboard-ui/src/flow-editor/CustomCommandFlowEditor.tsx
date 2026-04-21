import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import { Save, GripVertical, X } from 'lucide-react'
import { apiUrl } from '@/lib/apiBase'
import { flowNodeTypes } from './flowBlockNodes'
import { FlowBlockInspector } from './flowBlockInspector'
import {
  PALETTE_ITEMS,
  CATEGORY_STROKE,
  categoryForNodeType,
  defaultDataForType,
  type FlowNodeTypeId,
} from './flowMeta'

export type SerializedFlow = {
  name: string
  description: string
  nodes: Node[]
  edges: Edge[]
}

type RoleOpt = { id: string; name: string; color: string | null }

type InnerProps = {
  openedAsName: string | null
  guildId: string
  onClose: () => void
  onSaved: () => void
  nodes: Node[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  onNodesChange: import('@xyflow/react').OnNodesChange
  edges: Edge[]
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  onEdgesChange: import('@xyflow/react').OnEdgesChange
  saving: boolean
  setSaving: (v: boolean) => void
  saveErr: string | null
  setSaveErr: (v: string | null) => void
}

function newTriggerNode(): Node {
  return {
    id: crypto.randomUUID(),
    type: 'trigger_slash',
    position: { x: 260, y: 48 },
    data: { ...defaultDataForType('trigger_slash') },
  }
}

function serializeNodes(nodes: Node[]): Node[] {
  return nodes.map(({ id, type, position, data }) => ({
    id,
    type,
    position: { x: position.x, y: position.y },
    data: data ? { ...data } : {},
  }))
}

function serializeEdges(edges: Edge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }))
}

function FlowEditorBody(props: InnerProps) {
  const {
    openedAsName,
    guildId,
    onClose,
    onSaved,
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    saving,
    setSaving,
    saveErr,
    setSaveErr,
  } = props

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleOpt[]>([])
  const [rolesErr, setRolesErr] = useState<string | null>(null)

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId])

  useEffect(() => {
    if (!guildId) {
      setRoles([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(apiUrl(`/api/guild-roles?guildId=${encodeURIComponent(guildId)}`), {
          credentials: 'include',
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Rollen konnten nicht geladen werden.')
        if (cancelled) return
        setRoles(Array.isArray(j.roles) ? j.roles : [])
        setRolesErr(null)
      } catch (e) {
        if (!cancelled) setRolesErr(e instanceof Error ? e.message : 'Rollen-Fehler')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [guildId])

  const patchSelectedData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedId) return
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n))
      )
    },
    [selectedId, setNodes]
  )

  const onSave = async () => {
    setSaveErr(null)
    if (!guildId.trim()) {
      setSaveErr('Bitte oben einen Server auswählen — Flow-Commands sind an diesen Discord-Server gebunden.')
      return
    }
    const triggers = nodes.filter((n) => n.type === 'trigger_slash')
    if (triggers.length !== 1) {
      setSaveErr('Bitte genau einen Block „Slash Command“ einfügen.')
      return
    }
    const td = (triggers[0].data || {}) as { commandName?: string; commandDescription?: string }
    const name = String(td.commandName || '')
      .toLowerCase()
      .trim()
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
      setSaveErr('Ungültiger Command-Name (a–z, 0–9, _, -, max. 32).')
      return
    }
    const description = String(td.commandDescription || '').trim().slice(0, 100)
    const body = {
      guildId,
      name,
      description,
      nodes: serializeNodes(nodes),
      edges: serializeEdges(edges),
      ...(openedAsName && openedAsName !== name ? { previousName: openedAsName } : {}),
    }
    setSaving(true)
    try {
      const r = await fetch(apiUrl('/api/custom-commands/save'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Speichern fehlgeschlagen (HTTP ${r.status})`)
      onSaved()
      onClose()
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--sidebar)]/90 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">Flow-Editor</h2>
          <p className="text-xs text-zinc-500">Eigener Slash-Command · Zielserver oben wählen (Rollen &amp; Rechte)</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {saveErr ? (
            <span className="max-w-[min(100%,280px)] truncate text-xs text-red-300" title={saveErr}>
              {saveErr}
            </span>
          ) : null}
          <button type="button" className="dash-btn px-4" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="dash-btn dash-btn-accent flex items-center gap-2 px-4 font-semibold"
            disabled={saving}
            onClick={() => void onSave()}
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar)]/80 md:w-52 md:border-b-0 md:border-r">
          <p className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Blöcke
          </p>
          <div className="max-h-40 overflow-y-auto p-2 md:max-h-none md:flex-1">
            {PALETTE_ITEMS.map((item) => {
              if (item.type === 'trigger_slash' && nodes.some((n) => n.type === 'trigger_slash')) return null
              const Icon = item.icon
              const stroke = CATEGORY_STROKE[item.category]
              return (
                <div
                  key={item.type}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/mynex-flow', item.type)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="mb-1.5 flex cursor-grab items-center gap-2 rounded-lg border border-[var(--border)] bg-black/20 px-2 py-2 text-left text-sm text-zinc-200 active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                  <Icon className="h-4 w-4 shrink-0" style={{ color: stroke }} aria-hidden />
                  <span className="min-w-0 truncate">{item.label}</span>
                </div>
              )
            })}
          </div>
          <p className="hidden px-3 pb-2 text-[10px] text-zinc-600 md:block">
            Blöcke auf die Fläche ziehen, Handles verbinden.
          </p>
        </aside>

        <ReactFlowProvider>
          <div className="flex min-h-[280px] min-w-0 flex-1 flex-col">
            <FlowCanvasPane
              nodes={nodes}
              setNodes={setNodes}
              onNodesChange={onNodesChange}
              edges={edges}
              setEdges={setEdges}
              onEdgesChange={onEdgesChange}
              setSaveErr={setSaveErr}
              onNodeSelect={setSelectedId}
            />
          </div>
        </ReactFlowProvider>

        <aside className="flex w-full shrink-0 flex-col border-t border-[var(--border)] bg-[var(--sidebar)]/80 md:w-72 md:border-l md:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Block-Einstellungen</p>
            <button
              type="button"
              className="dash-btn shrink-0 border-0 bg-transparent px-2 py-1 text-zinc-400 hover:text-white"
              onClick={onClose}
              aria-label="Schließen"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-[100px] flex-1 overflow-y-auto p-3 text-sm">
            {!selected ? (
              <p className="text-zinc-500">Wähle einen Block auf dem Canvas.</p>
            ) : (
              <FlowBlockInspector
                node={selected}
                roles={roles}
                rolesErr={rolesErr}
                guildId={guildId}
                onPatch={patchSelectedData}
              />
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

/** Wrapper: ReactFlow onNodeClick muss innerhalb von Provider liegen */
function FlowCanvasPane(
  props: Pick<
    InnerProps,
    'nodes' | 'setNodes' | 'onNodesChange' | 'edges' | 'setEdges' | 'onEdgesChange' | 'setSaveErr'
  > & { onNodeSelect: (id: string | null) => void }
) {
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    setSaveErr,
    onNodeSelect,
  } = props

  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = nodes.find((n) => n.id === params.source)
      const stroke = CATEGORY_STROKE[categoryForNodeType(srcNode?.type)]
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke, strokeWidth: 2 },
          },
          eds
        )
      )
    },
    [nodes, setEdges]
  )

  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/mynex-flow')
      if (!raw) return
      const type = raw as FlowNodeTypeId
      if (type === 'trigger_slash' && nodes.some((n) => n.type === 'trigger_slash')) {
        setSaveErr('Es darf nur ein Slash-Trigger existieren.')
        return
      }
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = crypto.randomUUID()
      setNodes((nds) =>
        nds.concat({
          id,
          type,
          position: pos,
          data: { ...defaultDataForType(type) },
        })
      )
      setSaveErr(null)
    },
    [nodes, screenToFlowPosition, setNodes, setSaveErr]
  )

  return (
    <div className="relative min-h-[320px] flex-1 md:min-h-0" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={flowNodeTypes}
        onNodeClick={(_, n) => onNodeSelect(n.id)}
        onPaneClick={() => onNodeSelect(null)}
        fitView
        className="bg-zinc-950/80"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#27272a" />
        <Controls className="!m-2 !border !border-[var(--border)] !bg-[var(--sidebar)] !shadow-lg" />
        <MiniMap
          className="!border !border-[var(--border)] !bg-[var(--sidebar)]/90"
          maskColor="rgba(0,0,0,0.45)"
        />
      </ReactFlow>
    </div>
  )
}

type EditorProps = {
  initialFlow: SerializedFlow | null
  openedAsName: string | null
  guildId: string
  onClose: () => void
  onSaved: () => void
}

export function CustomCommandFlowEditor({ initialFlow, openedAsName, guildId, onClose, onSaved }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialFlow?.nodes?.length ? (initialFlow.nodes as Node[]) : [newTriggerNode()]
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState((initialFlow?.edges as Edge[]) || [])
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-[var(--main-black)]">
      <FlowEditorBody
        openedAsName={openedAsName}
        guildId={guildId}
        onClose={onClose}
        onSaved={onSaved}
        nodes={nodes}
        setNodes={setNodes}
        onNodesChange={onNodesChange}
        edges={edges}
        setEdges={setEdges}
        onEdgesChange={onEdgesChange}
        saving={saving}
        setSaving={setSaving}
        saveErr={saveErr}
        setSaveErr={setSaveErr}
      />
    </div>
  )
}
