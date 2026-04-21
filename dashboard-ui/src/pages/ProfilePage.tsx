import type { Snapshot } from '@/hooks/useSnapshot'
import { BotProfilePanel } from '@/components/BotProfilePanel'

export function ProfilePage({ data }: { data: Snapshot | null }) {
  const online = Boolean(data?.bot?.ready && data?.bot?.tag)

  return (
    <div className="dash-page-shell-sm">
      <div>
        <h1 className="dash-page-title">Bot-Profil</h1>
        <p className="dash-page-desc">
          Name, Bio, Avatar, Banner, Status und Aktivität — nur sichtbar mit gültiger Dashboard-Session.
        </p>
      </div>
      <BotProfilePanel botOnline={online} />
    </div>
  )
}
