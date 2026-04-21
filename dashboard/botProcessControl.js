import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const botEntry = path.join(rootDir, 'index.js');

/**
 * @param {import('discord.js').Client | null | undefined} client
 */
async function destroyClient(client) {
    if (!client) return;
    try {
        if (typeof client.isReady === 'function' && client.isReady()) {
            await client.destroy();
            return;
        }
        if (typeof client.destroy === 'function') {
            await client.destroy();
        }
    } catch {
        /* ignore */
    }
}

/**
 * @param {import('discord.js').Client | null | undefined} client
 * @param {'stop' | 'restart'} action
 */
export async function runBotProcessAction(client, action) {
    if (action === 'stop') {
        await destroyClient(client);
        process.exit(0);
    }

    if (action === 'restart') {
        await destroyClient(client);
        const child = spawn(process.execPath, [botEntry], {
            cwd: rootDir,
            detached: true,
            stdio: 'ignore',
            env: process.env
        });
        child.unref();
        await new Promise(r => setTimeout(r, 400));
        process.exit(0);
    }
}
