import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import { memo } from 'react'
import { BLOCK_REGISTRY, type BlockCategory, type BlockDef } from './blockRegistry'
import { cn } from '@/lib/utils'

function shell(category: BlockCategory, selected: boolean) {
  const border =
    category === 'trigger' || category === 'message'
      ? 'border-blue-500/50 bg-blue-500/15'
      : category === 'logic'
        ? 'border-yellow-500/50 bg-yellow-500/10'
        : category === 'error'
          ? 'border-red-500/50 bg-red-500/10'
          : 'border-violet-500/50 bg-violet-500/10'
  return cn(
    'min-w-[200px] max-w-[260px] rounded-xl border px-3 py-2 shadow-sm transition-shadow',
    border,
    selected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--main-black)]'
  )
}

function handleColor(category: BlockCategory): string {
  if (category === 'trigger' || category === 'message') return '!bg-blue-400'
  if (category === 'logic') return '!bg-yellow-400'
  if (category === 'error') return '!bg-red-400'
  return '!bg-violet-400'
}

const SUMMARY_KEYS = [
  'content',
  'title',
  'description',
  'note',
  'message',
  'key',
  'left',
  'right',
  'roleId',
  'channelId',
  'threadId',
  'messageId',
  'nickname',
  'times',
  'percent',
  'userId',
  'modalTitle',
  'statusText',
  'operation',
  'permission',
  'text',
]

function summarizeData(d: Record<string, unknown>): string {
  for (const k of SUMMARY_KEYS) {
    const v = d[k]
    if (v != null && String(v).trim()) return String(v).replace(/\s+/g, ' ').slice(0, 56)
  }
  return ''
}

function FlowBlockNodeInner({ def, data, selected }: NodeProps & { def: BlockDef }) {
  const d = (data || {}) as Record<string, unknown>
  const cat = def.category
  const hc = handleColor(cat)
  const sub = summarizeData(d)
  const Icon = def.icon

  if (def.type === 'trigger_slash') {
    return (
      <div className={shell('trigger', selected)}>
        <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-1.5">
          <Icon className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-200">{def.label}</span>
        </div>
        <p className="font-mono text-sm text-blue-200">/{String(d.commandName || '…')}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{String(d.commandDescription || '—')}</p>
        <Handle type="source" position={Position.Bottom} id="out" className={cn('!h-3 !w-3 !border-2', hc)} />
      </div>
    )
  }

  if (def.type === 'logic_error_handler') {
    return (
      <div className={shell('error', selected)}>
        <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-1.5">
          <Icon className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-200">{def.label}</span>
        </div>
        <p className="line-clamp-2 text-xs text-zinc-400">{String(d.message || '—')}</p>
        <p className="mt-1 text-[10px] text-zinc-600">Pfad bei Flow-Fehler</p>
        <Handle type="source" position={Position.Bottom} id="out" className="!h-3 !w-3 !border-2 !bg-red-400" />
      </div>
    )
  }

  if (def.branch) {
    return (
      <div className={shell(cat, selected)}>
        <Handle type="target" position={Position.Top} id="in" className={cn('!h-3 !w-3 !border-2', hc)} />
        <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-1.5">
          <Icon className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-200">{def.label}</span>
        </div>
        <p className="line-clamp-2 text-xs text-zinc-400">{sub || '—'}</p>
        <div className="relative mt-2 h-4">
          <span className="absolute left-[18%] top-0 text-[10px] text-green-400/90">wahr</span>
          <span className="absolute right-[14%] top-0 text-[10px] text-red-400/90">falsch</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!h-3 !w-3 !border-2 !bg-green-400"
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!h-3 !w-3 !border-2 !bg-red-400"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    )
  }

  const usesErrorOut =
    !def.branch &&
    def.type !== 'bg_note' &&
    def.type !== 'bg_helper_text' &&
    def.type !== 'bg_loop_stop'

  if (usesErrorOut) {
    return (
      <div className={shell(cat, selected)}>
        <Handle type="target" position={Position.Top} id="in" className={cn('!h-3 !w-3 !border-2', hc)} />
        <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-1.5">
          <Icon className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-200">{def.label}</span>
        </div>
        <p className="line-clamp-3 text-xs text-zinc-400">{sub || '—'}</p>
        <div className="relative mt-2 h-5 shrink-0">
          <span className="absolute left-[14%] top-0 text-[9px] text-zinc-500">ok</span>
          <span className="absolute right-[12%] top-0 text-[9px] text-orange-300/90">fehler</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="out"
            className={cn('!h-3 !w-3 !border-2', hc)}
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="error"
            className="!h-3 !w-3 !border-2 !bg-orange-400"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={shell(cat, selected)}>
      <Handle type="target" position={Position.Top} id="in" className={cn('!h-3 !w-3 !border-2', hc)} />
      <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-1.5">
        <Icon className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-200">{def.label}</span>
      </div>
      <p className="line-clamp-3 text-xs text-zinc-400">{sub || '—'}</p>
      <Handle type="source" position={Position.Bottom} id="out" className={cn('!h-3 !w-3 !border-2', hc)} />
    </div>
  )
}

function makeBlockComponent(def: BlockDef) {
  const C = memo(function BlockNode(props: NodeProps) {
    return <FlowBlockNodeInner {...props} def={def} />
  })
  C.displayName = `FlowBlock_${def.type}`
  return C
}

export const flowNodeTypes = Object.fromEntries(
  BLOCK_REGISTRY.map((def) => [def.type, makeBlockComponent(def)])
) as unknown as NodeTypes
