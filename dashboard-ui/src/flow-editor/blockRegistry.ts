import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  Bot,
  Calculator,
  Clock,
  Dices,
  Equal,
  Eraser,
  FileInput,
  FileText,
  Fingerprint,
  GitBranch,
  Hash,
  HelpCircle,
  Headphones,
  KeyRound,
  LayoutTemplate,
  Link2,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Mic,
  MicOff,
  PanelsTopLeft,
  Pencil,
  PencilLine,
  Pin,
  Repeat,
  Send,
  Share2,
  Shield,
  ShieldOff,
  ShieldPlus,
  Smile,
  Sparkles,
  Square,
  StickyNote,
  Terminal,
  Timer,
  Trash2,
  Type,
  Unplug,
  User,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  Variable,
  VolumeX,
} from 'lucide-react'

export type BlockCategory = 'trigger' | 'message' | 'server' | 'logic' | 'error'

export type BlockDef = {
  type: string
  label: string
  category: BlockCategory
  icon: LucideIcon
  /** true/false-Ausgänge für Verzweigungen */
  branch?: boolean
  /** Legacy / deaktiviert — weiter ausführbar, nicht in Palette */
  hideInPalette?: boolean
  defaultData: Record<string, unknown>
}

/** Stroke-Farben: Nachrichten blau, Server violett, Logik gelb, Fehler rot */
export const CATEGORY_STROKE: Record<BlockCategory, string> = {
  trigger: '#3b82f6',
  message: '#3b82f6',
  server: '#a855f7',
  logic: '#eab308',
  error: '#ef4444',
}

export const BLOCK_REGISTRY: BlockDef[] = [
  {
    type: 'trigger_slash',
    label: 'Slash Command',
    category: 'trigger',
    icon: Terminal,
    defaultData: {
      commandName: 'mein_befehl',
      commandDescription: 'Kurzbeschreibung',
      slashOptionsJson: '[]',
    },
  },
  {
    type: 'action_reply_text',
    label: 'Text-Antwort',
    category: 'message',
    icon: MessageSquare,
    defaultData: { content: 'Hallo!', ephemeral: false },
  },
  {
    type: 'action_reply_embed',
    label: 'Embed-Antwort',
    category: 'message',
    icon: LayoutTemplate,
    defaultData: { title: 'Titel', description: 'Beschreibung', color: '#5865F2', ephemeral: false },
  },
  {
    type: 'bg_msg_send_or_edit',
    label: 'Nachricht senden / bearbeiten',
    category: 'message',
    icon: Send,
    defaultData: {
      target: 'reply',
      content: '',
      ephemeral: false,
      embedTitle: '',
      embedDescription: '',
      embedColor: '#5865F2',
      channelId: '',
      userId: '',
    },
  },
  {
    type: 'bg_msg_edit_components',
    label: 'Komponenten bearbeiten',
    category: 'message',
    icon: PanelsTopLeft,
    defaultData: { channelId: '', messageId: '' },
  },
  {
    type: 'bg_msg_send_form',
    label: 'Modal / Formular',
    category: 'message',
    icon: FileInput,
    defaultData: { modalTitle: 'Formular', field1Label: 'Eingabe' },
  },
  {
    type: 'bg_msg_delete',
    label: 'Nachricht löschen',
    category: 'message',
    icon: Trash2,
    defaultData: { channelId: '', messageId: '' },
  },
  {
    type: 'bg_msg_publish',
    label: 'Nachricht veröffentlichen',
    category: 'message',
    icon: Share2,
    defaultData: { channelId: '', messageId: '' },
  },
  {
    type: 'bg_msg_react',
    label: 'Reaktion hinzufügen',
    category: 'message',
    icon: Smile,
    defaultData: { channelId: '', messageId: '', emoji: '👍' },
  },
  {
    type: 'bg_msg_pin',
    label: 'Nachricht anheften',
    category: 'message',
    icon: Pin,
    defaultData: { channelId: '', messageId: '' },
  },
  {
    type: 'bg_msg_transcript',
    label: 'Transcript (Verlauf)',
    category: 'message',
    icon: FileText,
    defaultData: { channelId: '', limit: 50 },
  },
  {
    type: 'action_kick',
    label: 'Kick',
    category: 'server',
    icon: UserMinus,
    defaultData: { reason: '' },
  },
  {
    type: 'action_ban',
    label: 'Ban',
    category: 'server',
    icon: Ban,
    defaultData: { reason: '', deleteMessageDays: 0 },
  },
  {
    type: 'action_timeout',
    label: 'Timeout',
    category: 'server',
    icon: Timer,
    defaultData: { minutes: 10, reason: '' },
  },
  {
    type: 'action_role_add',
    label: 'Rolle hinzufügen',
    category: 'server',
    icon: UserPlus,
    defaultData: { roleId: '' },
  },
  {
    type: 'action_role_remove',
    label: 'Rolle entfernen',
    category: 'server',
    icon: UserX,
    defaultData: { roleId: '' },
  },
  {
    type: 'bg_role_add_all',
    label: 'Rolle allen geben',
    category: 'server',
    icon: Users,
    defaultData: { roleId: '' },
  },
  {
    type: 'bg_role_remove_all',
    label: 'Rolle allen wegnehmen',
    category: 'server',
    icon: UserX,
    defaultData: { roleId: '' },
  },
  {
    type: 'bg_role_create',
    label: 'Rolle erstellen',
    category: 'server',
    icon: ShieldPlus,
    defaultData: { roleName: 'Neue Rolle', color: '99AAB5' },
  },
  {
    type: 'bg_role_delete',
    label: 'Rolle löschen',
    category: 'server',
    icon: ShieldOff,
    defaultData: { roleId: '' },
  },
  {
    type: 'bg_role_edit',
    label: 'Rolle bearbeiten',
    category: 'server',
    icon: Shield,
    defaultData: { roleId: '', newName: '', newColor: '' },
  },
  {
    type: 'bg_channel_create',
    label: 'Kanal erstellen',
    category: 'server',
    icon: Hash,
    defaultData: { channelName: 'kanal', channelType: 'text' },
  },
  {
    type: 'bg_channel_edit',
    label: 'Kanal bearbeiten',
    category: 'server',
    icon: Pencil,
    defaultData: { channelId: '', newName: '' },
  },
  {
    type: 'bg_channel_delete',
    label: 'Kanal löschen',
    category: 'server',
    icon: Trash2,
    defaultData: { channelId: '' },
  },
  {
    type: 'bg_thread_create',
    label: 'Thread erstellen',
    category: 'server',
    icon: MessagesSquare,
    defaultData: { channelId: '', threadName: 'thread', outputThreadVar: '' },
  },
  {
    type: 'bg_thread_edit',
    label: 'Thread bearbeiten',
    category: 'server',
    icon: PencilLine,
    defaultData: { threadId: '', newName: '' },
  },
  {
    type: 'bg_thread_delete',
    label: 'Thread löschen',
    category: 'server',
    icon: Trash2,
    defaultData: { threadId: '' },
  },
  {
    type: 'bg_voice_join',
    label: 'Voice beitreten (Bot)',
    category: 'server',
    icon: Mic,
    defaultData: { channelId: '' },
  },
  {
    type: 'bg_voice_leave',
    label: 'Voice verlassen (Bot)',
    category: 'server',
    icon: MicOff,
    defaultData: {},
  },
  {
    type: 'bg_voice_move',
    label: 'Mitglied verschieben (Voice)',
    category: 'server',
    icon: ArrowRightLeft,
    defaultData: { channelId: '' },
  },
  {
    type: 'bg_voice_disconnect',
    label: 'Voice trennen (Ziel)',
    category: 'server',
    icon: Unplug,
    defaultData: {},
  },
  {
    type: 'bg_voice_kick',
    label: 'Voice Kick (Ziel)',
    category: 'server',
    icon: UserX,
    defaultData: {},
  },
  {
    type: 'bg_voice_mute',
    label: 'Voice Mute (Ziel)',
    category: 'server',
    icon: VolumeX,
    defaultData: { mode: 'true' },
  },
  {
    type: 'bg_voice_deafen',
    label: 'Voice Deafen (Ziel)',
    category: 'server',
    icon: Headphones,
    defaultData: { mode: 'true' },
  },
  {
    type: 'bg_server_nickname',
    label: 'Nickname setzen',
    category: 'server',
    icon: BadgeCheck,
    defaultData: { nickname: '' },
  },
  {
    type: 'bg_server_purge',
    label: 'Nachrichten löschen (Bulk)',
    category: 'server',
    icon: Eraser,
    defaultData: { channelId: '', amount: 10 },
  },
  {
    type: 'bg_server_leave',
    label: 'Server verlassen',
    category: 'server',
    icon: LogOut,
    defaultData: { confirm: '' },
  },
  {
    type: 'bg_server_invite',
    label: 'Einladung erstellen',
    category: 'server',
    icon: Link2,
    defaultData: { channelId: '', maxAge: 3600, maxUses: 0 },
  },
  {
    type: 'bg_var_set',
    label: 'Variable setzen',
    category: 'logic',
    icon: Variable,
    defaultData: { key: '', value: '' },
  },
  {
    type: 'bg_var_equation',
    label: 'Variable rechnen',
    category: 'logic',
    icon: Calculator,
    defaultData: { key: '', operation: 'add', operand: '0' },
  },
  {
    type: 'bg_var_delete',
    label: 'Variable löschen',
    category: 'logic',
    icon: Eraser,
    defaultData: { key: '' },
  },
  {
    type: 'bg_loop_run',
    label: 'Schleife (N mal)',
    category: 'logic',
    icon: Repeat,
    defaultData: { times: 1 },
  },
  {
    type: 'bg_loop_stop',
    label: 'Schleife stoppen',
    category: 'logic',
    icon: Square,
    defaultData: {},
  },
  {
    type: 'bg_note',
    label: 'Notiz (kein Effekt)',
    category: 'logic',
    icon: StickyNote,
    defaultData: { note: '' },
  },
  {
    type: 'bg_helper_text',
    label: 'Hilfstext (nur Editor)',
    category: 'logic',
    icon: HelpCircle,
    defaultData: { text: '' },
  },
  {
    type: 'bg_other_wait',
    label: 'Warten (ms)',
    category: 'logic',
    icon: Clock,
    defaultData: { milliseconds: 1000 },
  },
  {
    type: 'bg_other_manipulate_text',
    label: 'Text manipulieren',
    category: 'logic',
    icon: Type,
    defaultData: { input: '', operation: 'upper', outputKey: '' },
  },
  {
    type: 'bg_other_error_log',
    label: 'Fehler loggen (Konsole)',
    category: 'logic',
    icon: AlertTriangle,
    defaultData: { message: '' },
  },
  {
    type: 'bg_other_unique_var',
    label: 'Eindeutige Variable',
    category: 'logic',
    icon: Fingerprint,
    defaultData: { key: '', value: '' },
  },
  {
    type: 'bg_other_bot_status',
    label: 'Bot-Status (Legacy)',
    category: 'logic',
    icon: Bot,
    hideInPalette: true,
    defaultData: { statusText: 'Mynex', activityType: 'Playing' },
  },
  {
    type: 'logic_condition',
    label: 'Bedingung (Rolle)',
    category: 'logic',
    icon: GitBranch,
    branch: true,
    defaultData: { roleId: '' },
  },
  {
    type: 'cond_role',
    label: 'Bedingung: Nutzerrolle',
    category: 'logic',
    icon: Shield,
    branch: true,
    defaultData: { roleId: '' },
  },
  {
    type: 'cond_comparison',
    label: 'Bedingung: Vergleich',
    category: 'logic',
    icon: Equal,
    branch: true,
    defaultData: { left: '', operator: 'eq', right: '' },
  },
  {
    type: 'cond_permission',
    label: 'Bedingung: Berechtigung',
    category: 'logic',
    icon: KeyRound,
    branch: true,
    defaultData: { permission: 'Administrator' },
  },
  {
    type: 'cond_chance',
    label: 'Bedingung: Zufall %',
    category: 'logic',
    icon: Dices,
    branch: true,
    defaultData: { percent: 50 },
  },
  {
    type: 'cond_channel',
    label: 'Bedingung: Kanal',
    category: 'logic',
    icon: Hash,
    branch: true,
    defaultData: { channelId: '' },
  },
  {
    type: 'cond_user',
    label: 'Bedingung: Nutzer',
    category: 'logic',
    icon: User,
    branch: true,
    defaultData: { userId: '' },
  },
  {
    type: 'cond_premium',
    label: 'Bedingung: Premium-Modus',
    category: 'logic',
    icon: Sparkles,
    branch: true,
    defaultData: { expectPremium: 'true' },
  },
  {
    type: 'logic_error_handler',
    label: 'Error Handler',
    category: 'error',
    icon: AlertTriangle,
    defaultData: { message: 'Es ist ein Fehler aufgetreten.' },
  },
]

const blockByType = new Map(BLOCK_REGISTRY.map((b) => [b.type, b]))

export function getBlockDef(type: string | undefined): BlockDef | undefined {
  if (!type) return undefined
  return blockByType.get(type)
}

export const BRANCH_NODE_TYPES = new Set(BLOCK_REGISTRY.filter((b) => b.branch).map((b) => b.type))

export type FlowNodeTypeId = string

export type PaletteItem = {
  type: string
  label: string
  category: BlockCategory
  icon: LucideIcon
}

export const PALETTE_ITEMS: PaletteItem[] = BLOCK_REGISTRY.filter((b) => !b.hideInPalette).map(
  ({ type, label, category, icon }) => ({
    type,
    label,
    category,
    icon,
  })
)

export function categoryForNodeType(type: string | undefined): BlockCategory {
  return getBlockDef(type)?.category ?? 'logic'
}

export function defaultDataForType(type: string): Record<string, unknown> {
  const d = getBlockDef(type)
  if (!d) return {}
  return { ...d.defaultData }
}
