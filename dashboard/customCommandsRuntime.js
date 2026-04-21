import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import * as store from './store.js';
import * as customCommandsStore from './customCommandsStore.js';
import { appendFlowErrorLog } from './guildSettingsStore.js';
import {
    executeFlowNode,
    evaluateConditionBranch,
    FLOW_NODE_TYPES_REQUIRING_ZIEL
} from './customCommandFlowActions.js';

/** @typedef {{ name: string, description: string, nodes: FlowNode[], edges: FlowEdge[] }} FlowDocument */
/** @typedef {{ id: string, type?: string, position?: { x: number, y: number }, data?: Record<string, unknown> }} FlowNode */
/** @typedef {{ id: string, source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null }} FlowEdge */

/** @type {Set<string>} */
/** Aus Sicherheitsgründen entfernt: beliebige HTTP-Aufrufe vom Bot-Host (SSRF/Missbrauch). */
const DISALLOWED_FLOW_NODE_TYPES = new Set(['bg_api_request', 'bg_api_ifttt']);

const CONDITION_NODE_TYPES = new Set([
    'logic_condition',
    'cond_role',
    'cond_comparison',
    'cond_permission',
    'cond_chance',
    'cond_channel',
    'cond_user',
    'cond_premium'
]);

/** @type {Map<string, Map<string, FlowDocument>>} guildId -> (commandName -> Flow) */
let flowsByGuild = new Map();
/** @type {Set<string>} */
let reservedBuiltin = new Set();

/** Einfacher Cooldown pro Server+User gegen Flow-Spam (Lastschutz). */
const customCmdCooldownMs = 1800;
const lastCustomCmdAt = new Map();

/**
 * @param {string[]} names Builtin-Slash-Namen (kleinschreibung egal, wird normalisiert).
 */
export function setReservedSlashNames(names) {
    reservedBuiltin = new Set((names || []).map(n => String(n).toLowerCase()));
}

/** Max. JSON-Größe für Flow-Speichern (Bytes UTF-8), passend zu readBody im HTTP-Handler. */
export const MAX_FLOW_JSON_BYTES = 500 * 1024;
const MAX_FLOW_NODES = 400;
const MAX_FLOW_EDGES = 800;
/** React-Flow nutzt u. a. UUIDs als Knoten-IDs. */
const ID_RE = /^[0-9a-zA-Z_.-]{1,80}$/;
const TYPE_RE = /^[a-z0-9_.-]{1,80}$/i;

/**
 * Payload-Check fürs Dashboard (vor dem Schreiben auf die Platte).
 * @param {unknown} body
 * @param {Set<string>} reservedSet
 * @returns {{ ok: true, name: string, guildId: string } | { ok: false, error: string }}
 */
export function validateFlowForSave(body, reservedSet) {
    if (body == null || typeof body !== 'object') {
        return { ok: false, error: 'Body muss ein JSON-Objekt sein.' };
    }
    let payloadSize = 0;
    try {
        payloadSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
        return { ok: false, error: 'Flow-Daten sind kein serialisierbares JSON.' };
    }
    if (payloadSize > MAX_FLOW_JSON_BYTES) {
        return { ok: false, error: `Flow-JSON zu gross (max. ${MAX_FLOW_JSON_BYTES} Bytes).` };
    }

    const guildId = customCommandsStore.safeGuildId(body.guildId);
    if (!guildId) {
        return { ok: false, error: 'guildId fehlt oder ist ungültig (Server-Kontext erforderlich).' };
    }
    const name = customCommandsStore.safeCommandName(typeof body.name === 'string' ? body.name : '');
    if (!name) {
        return {
            ok: false,
            error: 'Ungültiger Command-Name (nur a-z, 0-9, _, -, max. 32 Zeichen).'
        };
    }
    if (typeof body.previousName === 'string' && body.previousName.trim()) {
        const p = customCommandsStore.safeCommandName(body.previousName);
        if (!p) {
            return { ok: false, error: 'Ungültiger previousName.' };
        }
    }
    if (reservedSet.has(name)) {
        return { ok: false, error: 'Name kollidiert mit einem Builtin-Slash-Command.' };
    }
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
        return { ok: false, error: 'nodes und edges muessen Arrays sein.' };
    }
    if (body.nodes.length > MAX_FLOW_NODES) {
        return { ok: false, error: `Zu viele Knoten (max. ${MAX_FLOW_NODES}).` };
    }
    if (body.edges.length > MAX_FLOW_EDGES) {
        return { ok: false, error: `Zu viele Kanten (max. ${MAX_FLOW_EDGES}).` };
    }
    const triggers = body.nodes.filter(n => n?.type === 'trigger_slash');
    if (triggers.length !== 1) {
        return { ok: false, error: 'Genau ein Trigger-Block „Slash Command“ ist erforderlich.' };
    }
    const seenNodeIds = new Set();
    for (let i = 0; i < body.nodes.length; i++) {
        const n = body.nodes[i];
        if (!n || typeof n !== 'object') {
            return { ok: false, error: `Ungültiger Knoten bei Index ${i}.` };
        }
        const nid = typeof n.id === 'string' ? n.id : '';
        if (!ID_RE.test(nid)) {
            return { ok: false, error: 'Ungültige Knoten-ID (nur Buchstaben, Ziffern, _, -, ., max. 80).' };
        }
        if (seenNodeIds.has(nid)) {
            return { ok: false, error: 'Doppelte Knoten-ID.' };
        }
        seenNodeIds.add(nid);
        const t = typeof n.type === 'string' ? n.type : '';
        if (!TYPE_RE.test(t)) {
            return { ok: false, error: 'Ungültiger Knoten-Typ.' };
        }
        if (DISALLOWED_FLOW_NODE_TYPES.has(t)) {
            return {
                ok: false,
                error:
                    'Der Flow enthält entfernte Blöcke (HTTP API / IFTTT). Bitte diese Knoten löschen und erneut speichern.'
            };
        }
    }
    for (let i = 0; i < body.edges.length; i++) {
        const e = body.edges[i];
        if (!e || typeof e !== 'object') {
            return { ok: false, error: `Ungültige Kante bei Index ${i}.` };
        }
        const sid = typeof e.source === 'string' ? e.source : '';
        const tid = typeof e.target === 'string' ? e.target : '';
        if (!ID_RE.test(sid) || !ID_RE.test(tid)) {
            return { ok: false, error: 'Ungültige Kanten source/target.' };
        }
        if (!seenNodeIds.has(sid) || !seenNodeIds.has(tid)) {
            return { ok: false, error: 'Kante verweist auf unbekannten Knoten.' };
        }
    }
    return { ok: true, name, guildId };
}

export function reloadFromDisk() {
    flowsByGuild = new Map();
    for (const gid of customCommandsStore.listGuildIdsWithStoredFlows()) {
        for (const doc of customCommandsStore.listFlowDocumentsForGuild(gid)) {
            const key = String(doc.name || '').toLowerCase();
            if (!key) continue;
            if (reservedBuiltin.has(key)) {
                console.warn(`Custom-Command "${key}" auf Guild ${gid} ignoriert (Konflikt mit Builtin).`);
                continue;
            }
            if (!flowsByGuild.has(gid)) flowsByGuild.set(gid, new Map());
            flowsByGuild.get(gid).set(key, doc);
        }
    }
}

/**
 * Ob irgendwo Flow-Dateien existieren (Hinweis bei globalem Slash-Modus).
 * @returns {boolean}
 */
export function hasGuildScopedFlows() {
    return flowsByGuild.size > 0;
}

/**
 * @param {string} guildId
 * @param {string} name
 * @returns {boolean}
 */
export function isCustomCommandForGuild(guildId, name) {
    const g = String(guildId || '');
    const m = flowsByGuild.get(g);
    return Boolean(m?.has(String(name ?? '').toLowerCase()));
}

/**
 * Slash-JSON nur für einen Server (Guild-Commands).
 * @param {string} guildId
 * @returns {object[]}
 */
export function getSlashCommandBodiesForGuild(guildId) {
    const g = String(guildId || '');
    const m = flowsByGuild.get(g);
    if (!m) return [];
    const out = [];
    for (const flow of m.values()) {
        out.push(buildSlashJson(flow));
    }
    return out;
}

/**
 * Metadaten aller Flow-Commands (für Snapshot; Filter nach gewählter Guild in store.getSnapshot).
 * @returns {{ name: string, description: string, custom: true, guildId: string }[]}
 */
export function getAllStoreMetaEntries() {
    const out = [];
    for (const [gid, map] of flowsByGuild) {
        for (const f of map.values()) {
            out.push({
                name: f.name,
                description: f.description || '',
                custom: true,
                guildId: gid
            });
        }
    }
    return out;
}

/**
 * @param {FlowDocument} flow
 */
function flowNeedsTargetUser(flow) {
    return Boolean(flow.nodes?.some(n => FLOW_NODE_TYPES_REQUIRING_ZIEL.has(String(n.type || ''))));
}

/**
 * @param {FlowNode|undefined} trigger
 * @returns {object[]}
 */
function parseSlashOptionsFromTrigger(trigger) {
    const d = trigger?.data && typeof trigger.data === 'object' ? trigger.data : {};
    let raw = d.slashOptionsJson;
    if (typeof raw !== 'string') raw = '[]';
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

/**
 * @param {string} n
 */
function safeSlashOptionName(n) {
    const s = String(n || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 32);
    if (!s || !/^[a-z_]/.test(s)) return '';
    return s;
}

/**
 * @param {FlowDocument} flow
 */
function buildSlashJson(flow) {
    const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    const trigger = nodes.find(n => n.type === 'trigger_slash');
    const desc = (flow.description || 'Benutzerdefinierter Befehl').trim().slice(0, 100);
    const b = new SlashCommandBuilder().setName(flow.name).setDescription(desc || 'Custom');
    const used = new Set();
    if (flowNeedsTargetUser(flow)) {
        b.addUserOption(o => o.setName('ziel').setDescription('Zielnutzer').setRequired(true));
        used.add('ziel');
    }
    for (const o of parseSlashOptionsFromTrigger(trigger)) {
        const name = safeSlashOptionName(o.name);
        if (!name || used.has(name)) continue;
        used.add(name);
        const req = Boolean(o.required);
        const od = String(o.description || 'Option').slice(0, 100);
        const t = String(o.type || 'string').toLowerCase();
        try {
            if (t === 'string' || t === 'text') {
                b.addStringOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'integer' || t === 'zahl' || t === 'ganzzahl') {
                b.addIntegerOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'number' || t === 'float' || t === 'kommazahl') {
                b.addNumberOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'boolean' || t === 'bool') {
                b.addBooleanOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'user' || t === 'nutzer') {
                b.addUserOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'channel' || t === 'kanal') {
                b.addChannelOption(x => x.setName(name).setDescription(od).setRequired(req));
            } else if (t === 'role' || t === 'rolle') {
                b.addRoleOption(x => x.setName(name).setDescription(od).setRequired(req));
            }
        } catch {
            /* ungültige Kombination — überspringen */
        }
    }
    return b.toJSON();
}

/**
 * Kanten vom Knoten, optional mit sourceHandle.
 * @param {FlowEdge[]} edges
 * @param {string} sourceId
 * @param {string|null} sourceHandle null = default/out
 */
function nextTargets(edges, sourceId, sourceHandle) {
    return edges
        .filter(e => {
            if (e.source !== sourceId) return false;
            const h = e.sourceHandle || null;
            if (sourceHandle == null) return !h || h === 'out';
            return h === sourceHandle;
        })
        .map(e => e.target);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<boolean>} true wenn ausgeführt
 */
export async function tryExecuteCustomCommand(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    const gid = interaction.guildId;
    if (!gid) return false;
    const map = flowsByGuild.get(String(gid));
    if (!map) return false;
    const flow = map.get(String(interaction.commandName || '').toLowerCase());
    if (!flow) return false;

    const cdKey = `${gid}:${interaction.user.id}`;
    const now = Date.now();
    const prev = lastCustomCmdAt.get(cdKey) || 0;
    if (now - prev < customCmdCooldownMs) {
        await interaction
            .reply({
                content: '⏳ Bitte kurz warten, bevor du den Befehl erneut nutzt.',
                flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        return true;
    }
    lastCustomCmdAt.set(cdKey, now);

    await runFlow(interaction, flow);
    return true;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {FlowDocument} flow
 */
async function runFlow(interaction, flow) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
        await interaction.reply({
            content: '❌ Nur auf einem Server nutzbar.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    const edges = Array.isArray(flow.edges) ? flow.edges : [];
    /** @type {Map<string, FlowNode>} */
    const nodesById = new Map(nodes.map(n => [n.id, n]));

    const trigger = nodes.find(n => n.type === 'trigger_slash');
    if (!trigger) {
        await interaction.reply({
            content: '❌ Flow ohne Slash-Trigger.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const needsTarget = flowNeedsTargetUser(flow);
    const targetUser = needsTarget ? interaction.options.getUser('ziel', true) : interaction.user;
    let targetMember = needsTarget ? interaction.options.getMember('ziel') : interaction.member;
    if (needsTarget && targetUser && !targetMember) {
        targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    }

    const errorHandlerNode = nodes.find(n => n.type === 'logic_error_handler');
    const errorHandlerId = errorHandlerNode?.id || null;

    /** Für Bedingungen: Ziel falls vorhanden, sonst ausführendes Mitglied */
    const subjectMember = targetMember || interaction.member;

    /** @type {Map<string, string>} */
    const flowVars = new Map();
    const replyState = { usedFirstReply: false };
    let inErrorHandler = false;

    let steps = 0;
    const MAX_STEPS = 256;

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} ix
     * @param {bigint} perm
     * @param {string} label
     */
    async function ensureModPerm(ix, perm, label) {
        const member = ix.member;
        if (!member?.permissions?.has) {
            throw new Error('Mitgliedsdaten für Berechtigungsprüfung fehlen.');
        }
        if (!member.permissions.has(perm)) {
            throw new Error(`Dir fehlt die Berechtigung: ${label}`);
        }
        return true;
    }

    /**
     * @param {string} content
     * @param {boolean} ephemeral
     */
    async function sendLine(content, ephemeral) {
        const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content, flags });
            replyState.usedFirstReply = true;
            return;
        }
        if (!replyState.usedFirstReply) {
            await interaction.editReply({ content, allowedMentions: { parse: [] } });
            replyState.usedFirstReply = true;
        } else {
            await interaction.followUp({ content, flags, allowedMentions: { parse: [] } });
        }
    }

    /**
     * @param {{ content?: string, embeds?: import('discord.js').EmbedBuilder[], files?: import('discord.js').AttachmentBuilder[] }} payload
     * @param {boolean} ephemeral
     */
    async function sendRich(payload, ephemeral) {
        const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ ...payload, flags, allowedMentions: { parse: [] } });
            replyState.usedFirstReply = true;
            return;
        }
        if (!replyState.usedFirstReply) {
            await interaction.editReply({ ...payload, allowedMentions: { parse: [] } });
            replyState.usedFirstReply = true;
        } else {
            await interaction.followUp({ ...payload, flags, allowedMentions: { parse: [] } });
        }
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }

    /** @type {{ runWalk: (id: string) => Promise<void> } & Record<string, unknown>} */
    const api = {
        interaction,
        targetUser,
        targetMember,
        subjectMember,
        flowVars,
        edges,
        nodesById,
        sendLine,
        sendRich,
        ensureModPerm,
        replyState,
        nextTargets,
        runWalk: async () => {}
    };

    /**
     * @param {Error} err
     */
    async function runErrorHandler(err) {
        appendFlowErrorLog(interaction.guildId || '', `[handler] ${err?.message || 'Unbekannter Fehler'}`);
        if (!errorHandlerId) {
            await interaction
                .editReply({
                    content: `❌ ${err?.message || 'Unbekannter Fehler'}`,
                    allowedMentions: { parse: [] }
                })
                .catch(() => {});
            return;
        }
        const eh = nodesById.get(errorHandlerId);
        if (!eh) {
            await interaction
                .editReply({
                    content: `❌ ${err?.message || 'Unbekannter Fehler'}`,
                    allowedMentions: { parse: [] }
                })
                .catch(() => {});
            return;
        }
        const ed = eh.data && typeof eh.data === 'object' ? eh.data : {};
        const msg = typeof ed.message === 'string' ? ed.message.trim() : '';
        if (msg) await sendLine(msg, true);
        inErrorHandler = true;
        const outs = nextTargets(edges, errorHandlerId, 'out');
        for (const t of outs) {
            await walk(t);
        }
    }

    /**
     * @param {string} nodeId
     */
    async function walk(nodeId) {
        if (++steps > MAX_STEPS) throw new Error('Flow zu lang (Schritt-Limit).');
        const node = nodesById.get(nodeId);
        if (!node) return;

        if (node.type === 'trigger_slash') {
            for (const t of nextTargets(edges, node.id, null)) await walk(t);
            return;
        }
        if (node.type === 'logic_error_handler') {
            return;
        }

        try {
            const execResult = await executeFlowNode(node, api);
            if (execResult?.skipDefaultEdges) return;

            if (CONDITION_NODE_TYPES.has(String(node.type || ''))) {
                const ok = await evaluateConditionBranch(node, api);
                const handle = ok ? 'true' : 'false';
                for (const t of nextTargets(edges, node.id, handle)) await walk(t);
                return;
            }

            for (const t of nextTargets(edges, node.id, null)) await walk(t);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            const gid = interaction.guildId || '';
            appendFlowErrorLog(gid, `[${node.type}] ${err.message}`);
            const errOut = nextTargets(edges, node.id, 'error');
            if (errOut.length) {
                for (const t of errOut) await walk(t);
                return;
            }
            if (inErrorHandler) {
                await interaction
                    .editReply({
                        content: `❌ ${err.message}`,
                        allowedMentions: { parse: [] }
                    })
                    .catch(() => {});
                return;
            }
            await runErrorHandler(err);
        }
    }

    api.runWalk = walk;

    const startTargets = nextTargets(edges, trigger.id, null);
    if (startTargets.length === 0) {
        await interaction.editReply({ content: '✅ (Keine weiteren Schritte)', allowedMentions: { parse: [] } });
        return;
    }
    for (const t of startTargets) {
        await walk(t);
    }
}
