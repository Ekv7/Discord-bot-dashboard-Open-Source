import { Link } from 'react-router-dom'

export function DashboardPrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--main-black)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/80 p-6">
          <h1 className="text-2xl font-semibold">Datenschutzerklärung Dashboard</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Diese Seite beschreibt die Verarbeitung von Daten im Dashboard unter `dash.mynexstudios.com`.
          </p>
        </div>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">1. Verantwortlicher</h2>
          <p className="text-sm text-[var(--muted)]">
            MynexStudios
            <br />
            E-Mail: Support@mynexstudios.com
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">2. Cookies und Local Storage</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>
              `mynex_dash_sess` (Session-Cookie, 7 Tage, HttpOnly): enthält Sessiondaten für Authentifizierung
              (z. B. userId, username, avatar).
            </li>
            <li>
              `mynex_oauth_state` (OAuth-State-Cookie, 10 Minuten): Schutz des OAuth-Login-Flow gegen Missbrauch.
            </li>
            <li>`mynex-dashboard-theme` (localStorage): speichert nur die Theme-Einstellung (hell/dunkel).</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">3. Verarbeitete Daten im Betrieb</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>User-IDs und User-Tags</li>
            <li>Verwarnungen</li>
            <li>Server-Logs</li>
            <li>Je nach Event auch Nachrichteninhalte</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">4. Speicherdauer und Löschung</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>Aufbewahrung technisch begrenzt auf maximal 2000 Einträge pro Kategorie.</li>
            <li>Verwarnungen können über `/unwarn` und `/clearwarns` gelöscht werden.</li>
            <li>Es gibt keinen allgemeinen DSGVO-Lösch-Endpunkt im Dashboard.</li>
            <li>Löschanfragen bitte per E-Mail an Support@mynexstudios.com senden.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar)]/60 p-6">
          <h2 className="text-lg font-semibold">5. Deine Rechte nach DSGVO</h2>
          <p className="text-sm text-[var(--muted)]">
            Du hast grundsätzlich Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit
            und Widerspruch. Zur Ausübung der Rechte kontaktiere uns unter Support@mynexstudios.com.
          </p>
        </section>

        <div className="flex flex-wrap gap-3 pb-2">
          <Link className="dash-btn px-4" to="/impressum">
            Zum Impressum
          </Link>
          <Link className="dash-btn px-4" to="/login">
            Zurück zum Login
          </Link>
        </div>
      </div>
    </div>
  )
}
