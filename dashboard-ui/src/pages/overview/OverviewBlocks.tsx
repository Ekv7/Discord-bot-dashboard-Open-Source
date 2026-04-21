import type { LucideIcon } from 'lucide-react'
import { Activity } from 'lucide-react'
import type { Snapshot } from '@/hooks/useSnapshot'
import { serverLogOverviewBadgeClass, serverLogTypeLabel } from '@/lib/serverLogTypes'

type LogRow = Snapshot['serverLogs'][number]

function plainLogMessage(input: string): string {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint: string
  tone: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const ring =
    tone === 'blue'
      ? 'from-blue-500/15'
      : tone === 'emerald'
        ? 'from-emerald-500/15'
        : tone === 'amber'
          ? 'from-amber-500/15'
          : 'from-red-500/15'
  return (
    <div className="dash-panel group relative p-4 transition-colors hover:border-zinc-700/60">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ring} to-transparent opacity-80`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="dash-label">{label}</p>
          <p className="dash-stat-value">{value}</p>
          <p className="dash-hint mt-1">{hint}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2 text-zinc-500 transition-colors group-hover:text-zinc-400">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  )
}

export function MetaRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-2.5 last:border-0">
      <dt className="dash-label shrink-0">{label}</dt>
      <dd className={`text-right text-xs text-[var(--foreground)]/90 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

export function OverviewRecentEvents({ recent, totalCount }: { recent: LogRow[]; totalCount: number }) {
  return (
    <section className="dash-panel lg:col-span-3">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <h2 className="dash-section-title flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          Letzte Events
        </h2>
        <div className="flex items-center gap-3">
          <span className="dash-hint">Live · bis zu 5 Einträge</span>
          <span className="dash-hint">{totalCount} total</span>
        </div>
      </div>
      <ul className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
        {recent.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-[var(--muted)] sm:px-5">Noch keine Events.</li>
        ) : (
          recent.map((l, i) => (
            <li key={`${l.ts}-${i}`} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                    <time className="text-[11px] tabular-nums text-[var(--muted)]">
                  {new Date(l.ts).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${serverLogOverviewBadgeClass(l.type)}`}
                >
                  {serverLogTypeLabel(l.type)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[var(--foreground)]/80">
                <span className="font-medium text-[var(--foreground)]">{l.user}</span>
                <span className="mx-1.5 text-[var(--muted)]">·</span>
                <span className="whitespace-pre-wrap text-[var(--muted)]">{plainLogMessage(l.msg)}</span>
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
