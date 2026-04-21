import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { Users, UserMinus, TrendingUp } from 'lucide-react'
import type { DashboardServerScope } from '@/components/ServerScopeBanner'
import { ServerScopeBanner } from '@/components/ServerScopeBanner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type RangeStats = { joins: number; leaves: number; net: number }

type Summary = {
  d3: RangeStats
  d7: RangeStats
  d14: RangeStats
  d30: RangeStats
  all: RangeStats
}

type Daily = { date: string; joins: number; leaves: number }

export function StatsPage({
  selectedGuildId,
  serverScope,
}: {
  selectedGuildId: string
  serverScope: DashboardServerScope
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [series30, setSeries30] = useState<Daily[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedGuildId) return
    setSummary(null)
    setSeries30([])
    setErr(null)
    let cancelled = false
    async function load() {
      try {
        const query = `?guildId=${encodeURIComponent(selectedGuildId)}`
        const r = await fetch(apiUrl(`/api/member-stats${query}`), { credentials: 'include' })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
        if (!cancelled) {
          setSummary(j.summary)
          setSeries30(j.series30 || [])
          setErr(null)
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Fehler')
      }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [selectedGuildId])

  if (!selectedGuildId) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <p className="dash-page-desc">Server wird geladen…</p>
      </div>
    )
  }

  if (err) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <div className="dash-panel border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="dash-page-shell">
        <ServerScopeBanner scope={serverScope} />
        <p className="dash-page-desc">Statistiken werden geladen…</p>
      </div>
    )
  }

  const tabDefs: { id: keyof Summary; label: string; days: number }[] = [
    { id: 'd3', label: '3 Tage', days: 3 },
    { id: 'd7', label: '7 Tage', days: 7 },
    { id: 'd14', label: '14 Tage', days: 14 },
    { id: 'd30', label: '30 Tage', days: 30 },
    { id: 'all', label: 'Gesamt', days: 30 },
  ]

  return (
    <div className="dash-page-shell">
      <ServerScopeBanner scope={serverScope} />
      <div>
        <h1 className="dash-page-title">Mitglieder-Statistiken</h1>
        <p className="dash-page-desc">
          Joins und Leaves pro Zeitraum (seit Bot mit Member-Intent läuft und Daten in{' '}
          <code className="dash-code">data/member-stats/&lt;guildId&gt;.json</code> anfallen).
        </p>
      </div>

      <Tabs defaultValue="d7" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-[var(--border)] bg-black/20 p-1">
          {tabDefs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="min-h-[44px] px-3 py-2 text-xs sm:min-h-9 sm:py-1.5 sm:text-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabDefs.map((t) => {
          const s = summary[t.id] ?? { joins: 0, leaves: 0, net: 0 }
          const chartDays = t.id === 'all' ? series30 : series30.slice(-t.days)
          return (
            <TabsContent key={t.id} value={t.id} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Joins</CardTitle>
                    <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-1.5">
                      <Users className="h-4 w-4 text-emerald-400" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-400">{s.joins}</div>
                    <CardDescription>Neue Mitglieder im Zeitraum</CardDescription>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Leaves</CardTitle>
                    <span className="rounded-md border border-red-500/25 bg-red-500/10 p-1.5">
                      <UserMinus className="h-4 w-4 text-red-400" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-400">{s.leaves}</div>
                    <CardDescription>Austritte (inkl. Kick/Ban als Remove)</CardDescription>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                    <span className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-1.5">
                      <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-3xl font-bold ${s.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {s.net >= 0 ? '+' : ''}
                      {s.net}
                    </div>
                    <CardDescription>Joins minus Leaves</CardDescription>
                  </CardContent>
                </Card>
              </div>

              {chartDays.length > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t.id === 'all' ? 'Verlauf (30 Tage)' : `Tagesverteilung (${chartDays.length} Tage)`}
                    </CardTitle>
                    <CardDescription>
                      {t.id === 'all'
                        ? 'Karten oben: alle gespeicherten Tage · Balken: letzte 30 Tage'
                        : 'Joins grün, Leaves rot'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DailyBars days={chartDays} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <div className="dash-panel p-5">
        <h2 className="dash-section-title">Backup &amp; Daten</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Wichtige Dateien liegen unter <code className="dash-code">data/</code> (z. B.{' '}
          <code className="dash-code">member-stats/&lt;guildId&gt;.json</code>,{' '}
          <code className="dash-code">server-logs/&lt;guildId&gt;.json</code>,{' '}
          <code className="dash-code">warns/&lt;guildId&gt;.json</code>). Für Backups diesen Ordner regelmäßig kopieren oder in eure
          Server-Sicherung einbeziehen — nicht nur den Bot-Code.
        </p>
      </div>
    </div>
  )
}

function DailyBars({ days }: { days: Daily[] }) {
  const maxVal = Math.max(1, ...days.flatMap((d) => [d.joins, d.leaves]))
  const hasData = days.some((d) => d.joins > 0 || d.leaves > 0)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Joins
        </span>
        <span className="inline-flex items-center gap-1.5 text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Leaves
        </span>
        <span className="ml-auto rounded-md border border-[var(--border)] bg-black/20 px-2 py-0.5 text-[var(--muted)]">
          Peak: {maxVal}
        </span>
      </div>

      <div className="relative rounded-lg border border-[var(--border)] bg-black/15 p-3">
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-[var(--border)]/70" />
        <div className="pointer-events-none absolute inset-x-3 top-3 h-px bg-[var(--border)]/40" />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 h-px bg-[var(--border)]/40" />

        {!hasData ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">Keine Aktivität im gewählten Zeitraum.</p>
        ) : (
          <div className="flex h-44 items-end gap-1.5 overflow-x-auto">
            {days.map((d) => (
              <div key={d.date} className="flex min-w-[22px] flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div
                    className="w-1/2 max-w-[10px] rounded-t bg-emerald-500/85"
                    style={{ height: `${(d.joins / maxVal) * 100}%`, minHeight: d.joins ? 4 : 0 }}
                    title={`${d.date}: ${d.joins} joins`}
                  />
                  <div
                    className="w-1/2 max-w-[10px] rounded-t bg-red-500/85"
                    style={{ height: `${(d.leaves / maxVal) * 100}%`, minHeight: d.leaves ? 4 : 0 }}
                    title={`${d.date}: ${d.leaves} leaves`}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-[var(--muted)]">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
