import { CommandDefinition } from '../types';

function formatUptime(bootTimestamp: number): string {
    const diffSec = Math.floor((Date.now() - bootTimestamp) / 1000);
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

export const systemCommands: CommandDefinition[] = [
    {
        name: 'help',
        aliases: ['?', 'man'],
        category: 'system',
        description: 'Display available commands or inspect detailed manual for a command.',
        usage: 'help [command]',
        examples: ['help', 'help matrix', 'help calc'],
        execute: async ({ args, terminal, registry }) => {
            if (args.length > 0) {
                const target = registry.get(args[0]);
                if (!target) {
                    terminal.audio.playError();
                    await terminal.print(`No manual entry for "${args[0]}".`, { type: 'error' });
                    return;
                }

                await terminal.print(`MANUAL // ${target.name.toUpperCase()} (${target.category.toUpperCase()})`, {
                    type: 'success'
                });
                await terminal.print(`  Description : ${target.description}`);
                await terminal.print(`  Usage       : ${target.usage}`);
                if (target.aliases && target.aliases.length > 0) {
                    await terminal.print(`  Aliases     : ${target.aliases.join(', ')}`);
                }
                if (target.examples && target.examples.length > 0) {
                    await terminal.print(`  Examples    : ${target.examples.join('  |  ')}`);
                }
                return;
            }

            await terminal.print(
                'GHOST SHELL COMMAND DIRECTORY // Type "help <command>" for detailed usage:',
                { type: 'system' }
            );

            const rows = registry.getAll().map((cmd) => [
                cmd.name,
                cmd.category.toUpperCase(),
                                               cmd.aliases?.join(', ') || '-',
                                               cmd.description
            ]);

            terminal.printTable(['COMMAND', 'MODULE', 'ALIASES', 'DESCRIPTION'], rows);
        }
    },

{
    name: 'clear',
    aliases: ['cls'],
    category: 'system',
    description: 'Clear the terminal phosphor viewport buffer.',
    usage: 'clear',
    execute: ({ terminal }) => {
        terminal.clear();
    }
},

{
    name: 'sysinfo',
    aliases: ['neofetch', 'status'],
    category: 'system',
    description: 'Display hardware telemetry, phosphor calibration, and kernel specifications.',
    usage: 'sysinfo',
    execute: async ({ terminal }) => {
        const palette = terminal.getThemePalette();
        const uptime = formatUptime(terminal.state.bootTimestamp);
        const res = `${window.innerWidth}x${window.innerHeight}`;
        const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Logical Cores` : 'Quantum-8';

        const report = [
            '   .---.        OPERATOR   : ' + terminal.state.aliasTitle,
            '  /     \\       HOST       : ' + `${terminal.state.user}@${terminal.state.hostname}`,
            '  | () () |     KERNEL     : GHOST//OS 4.9.2-CRT (Zero-Dependency)',
            '   \\  ^  /      UPTIME     : ' + uptime,
            '    |||||       PHOSPHOR   : ' + `${palette.label} (${palette.phosphorCode})`,
            '    |||||       RESOLUTION : ' + `${res} @ 60Hz Progressive Scan`,
            '                CPU        : ' + cores,
            '                AUDIO DSP  : ' + (terminal.audio.enabled ? `WebAudio Synth (${Math.round(terminal.audio.volume * 100)}%)` : 'MUTED'),
            '                CANVAS FX  : ' + terminal.state.activeCanvasEffect.toUpperCase()
        ].join('\n');

        await terminal.print(report, { type: 'ascii' });
        terminal.audio.playSuccess();
    }
},

{
    name: 'whoami',
    aliases: ['id'],
    category: 'system',
    description: 'Display active operator identity and security clearance.',
    usage: 'whoami',
    execute: async ({ terminal }) => {
        await terminal.print(
            `uid=0(${terminal.state.user}) title="${terminal.state.aliasTitle}" clearance=${terminal.state.env.CLEARANCE}`,
                             { type: 'success' }
        );
    }
},

{
    name: 'ls',
    aliases: ['dir'],
    category: 'system',
    description: 'List files stored in the in-memory virtual filesystem.',
    usage: 'ls',
    execute: async ({ terminal }) => {
        const files = Object.values(terminal.state.fs);
        if (files.length === 0) {
            await terminal.print('Directory is empty.', { type: 'system' });
            return;
        }

        const rows = files.map((f) => [f.permissions, `${f.size} B`, f.updatedAt, f.name]);
        terminal.printTable(['PERMISSIONS', 'SIZE', 'MODIFIED', 'FILENAME'], rows);
    }
},

{
    name: 'cat',
    aliases: ['read', 'type'],
    category: 'system',
    description: 'Read and print the contents of a virtual file.',
    usage: 'cat <filename>',
    examples: ['cat manifesto.txt', 'cat ghost_protocol.md'],
    execute: async ({ args, terminal }) => {
        if (args.length === 0) {
            terminal.audio.playError();
            await terminal.print('Usage: cat <filename>', { type: 'error' });
            return;
        }

        const fileName = args[0];
        const file = terminal.state.fs[fileName];
        if (!file) {
            terminal.audio.playError();
            await terminal.print(`cat: ${fileName}: No such file in virtual storage`, { type: 'error' });
            return;
        }

        await terminal.print(file.content, { type: 'standard' });
    }
},

{
    name: 'write',
    aliases: ['touch'],
    category: 'system',
    description: 'Create or overwrite a file in the virtual filesystem.',
    usage: 'write <filename> <content...>',
    examples: ['write notes.txt "Deploy neural uplink at 0200 UTC"'],
    execute: async ({ args, terminal }) => {
        if (args.length < 1) {
            terminal.audio.playError();
            await terminal.print('Usage: write <filename> [content]', { type: 'error' });
            return;
        }

        const name = args[0];
        const content = args.slice(1).join(' ');
        const size = new TextEncoder().encode(content).length;
        const updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

        terminal.state.fs[name] = {
            name,
            content,
            permissions: '-rw-r--r--',
            updatedAt,
            size
        };

        terminal.audio.playSuccess();
        await terminal.print(`Wrote ${size} bytes to "${name}".`, { type: 'success' });
    }
},

{
    name: 'rm',
    aliases: ['del'],
    category: 'system',
    description: 'Remove a file from the virtual filesystem.',
    usage: 'rm <filename>',
    execute: async ({ args, terminal }) => {
        if (args.length === 0) {
            terminal.audio.playError();
            await terminal.print('Usage: rm <filename>', { type: 'error' });
            return;
        }

        const name = args[0];
        if (!terminal.state.fs[name]) {
            terminal.audio.playError();
            await terminal.print(`rm: cannot remove "${name}": No such file`, { type: 'error' });
            return;
        }

        delete terminal.state.fs[name];
        terminal.audio.playSuccess();
        await terminal.print(`Removed "${name}" from virtual storage.`, { type: 'warning' });
    }
},

{
    name: 'env',
    aliases: ['export'],
    category: 'system',
    description: 'Inspect or set shell environment variables.',
    usage: 'env [KEY=VALUE]',
    examples: ['env', 'env SECTOR=CASABLANCA-GRID'],
    execute: async ({ args, terminal }) => {
        if (args.length === 0) {
            const rows = Object.entries(terminal.state.env).map(([k, v]) => [k, v]);
            terminal.printTable(['VARIABLE', 'VALUE'], rows);
            return;
        }

        const pair = args.join(' ');
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
            const val = terminal.state.env[pair.toUpperCase()];
            if (val !== undefined) {
                await terminal.print(`${pair.toUpperCase()}=${val}`);
            } else {
                await terminal.print(`Variable "${pair}" is not defined.`, { type: 'warning' });
            }
            return;
        }

        const key = pair.slice(0, eqIdx).trim().toUpperCase();
        const val = pair.slice(eqIdx + 1).trim();
        terminal.state.env[key] = val;
        await terminal.print(`Exported ${key}="${val}"`, { type: 'success' });
    }
},

{
    name: 'history',
    category: 'system',
    description: 'Display or clear the persistent command history buffer.',
    usage: 'history [--clear]',
    supportedFlags: [{ long: 'clear', short: 'c', takesValue: false }],
    execute: async ({ flags, terminal }) => {
        if (flags.clear || flags.c) {
            terminal.clearHistory();
            await terminal.print('Command history purged.', { type: 'warning' });
            return;
        }

        const list = terminal.getHistory();
        if (list.length === 0) {
            await terminal.print('History buffer is empty.', { type: 'system' });
            return;
        }

        const formatted = list
        .map((cmd, idx) => `  ${String(idx + 1).padStart(3, '0')}  ${cmd}`)
        .join('\n');
        await terminal.print(formatted);
    }
},

{
    name: 'reboot',
    aliases: ['restart'],
    category: 'system',
    description: 'Re-initialize the CRT terminal and execute BIOS boot sequence.',
    usage: 'reboot',
    execute: async ({ terminal }) => {
        await terminal.reboot();
    }
}
];
