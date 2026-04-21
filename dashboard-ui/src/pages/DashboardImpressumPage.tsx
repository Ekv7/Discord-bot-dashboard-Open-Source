import { Link } from 'react-router-dom'

export function DashboardImpressumPage() {
  return (
    <div className="min-h-screen bg-[var(--main-black)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/80 p-6">
          <h1 className="text-2xl font-semibold">Impressum Dashboard</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Angaben gemäß § 5 DDG für dash.mynexstudios.com.</p>
        </div>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">Diensteanbieter</h2>
          <p className="text-sm text-[var(--muted)]">MynexStudios</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">Ladungsfähige Adresse</h2>
          <p className="text-sm text-[var(--muted)]">Adresse auf Anfrage</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">Kontakt</h2>
          <p className="text-sm text-[var(--muted)]">
            E-Mail: <a className="underline hover:no-underline" href="mailto:Support@mynexstudios.com">Support@mynexstudios.com</a>
          </p>
        </section>

        <div className="flex flex-wrap gap-3 pb-2">
          <Link className="dash-btn px-4" to="/datenschutz">
            Zum Datenschutz
          </Link>
          <Link className="dash-btn px-4" to="/login">
            Zurück zum Login
          </Link>
        </div>
      </div>
    </div>
  )
}
