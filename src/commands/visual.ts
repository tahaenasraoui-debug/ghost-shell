import { CommandDefinition, PhosphorTheme } from '../types';

const VALID_THEMES: PhosphorTheme[] = ['green', 'amber', 'cyan', 'magenta', 'white'];

const ASCII_FONT: Record<string, string[]> = {
    A: ['  ██  ', ' ████ ', '██  ██', '██████', '██  ██'],
    B: ['█████ ', '██  ██', '█████ ', '██  ██', '█████ '],
    C: [' █████', '██    ', '██    ', '██    ', ' █████'],
    D: ['█████ ', '██  ██', '██  ██', '██  ██', '█████ '],
    E: ['██████', '██    ', '█████ ', '██    ', '██████'],
    F: ['██████', '██    ', '█████ ', '██    ', '██    '],
    G: [' █████', '██    ', '██ ███', '██  ██', ' █████'],
    H: ['██  ██', '██  ██', '██████', '██  ██', '██  ██'],
    I: ['██████', '  ██  ', '  ██  ', '  ██  ', '██████'],
    J: ['██████', '   ██ ', '   ██ ', '██ ██ ', ' ███  '],
    K: ['██  ██', '██ ██ ', '████  ', '██ ██ ', '██  ██'],
    L: ['██    ', '██    ', '██    ', '██    ', '██████'],
    M: ['██   ██', '███ ███', '███████', '██ █ ██', '██   ██'],
    N: ['██   ██', '███  ██', '████ ██', '██ ████', '██   ██'],
    O: [' ████ ', '██  ██', '██  ██', '██  ██', ' ████ '],
    P: ['█████ ', '██  ██', '█████ ', '██    ', '██    '],
    Q: [' ████ ', '██  ██', '██  ██', '██ ██ ', ' ██ ██'],
    R: ['█████ ', '██  ██', '█████ ', '██ ██ ', '██  ██'],
    S: [' █████', '██    ', ' ████ ', '    ██', '█████ '],
    T: ['██████', '  ██  ', '  ██  ', '  ██  ', '  ██  '],
    U: ['██  ██', '██  ██', '██  ██', '██  ██', ' ████ '],
    V: ['██  ██', '██  ██', '██  ██', ' ████ ', '  ██  '],
    W: ['██   ██', '██ █ ██', '███████', '███ ███', '██   ██'],
    X: ['██  ██', ' ████ ', '  ██  ', ' ████ ', '██  ██'],
    Y: ['██  ██', ' ████ ', '  ██  ', '  ██  ', '  ██  '],
    Z: ['██████', '   ██ ', '  ██  ', ' ██   ', '██████'],
    '0': [' ████ ', '██ ███', '██████', '███ ██', ' ████ '],
    '1': ['  ██  ', ' ███  ', '  ██  ', '  ██  ', '██████'],
    '2': [' ████ ', '██  ██', '   ██ ', ' ██   ', '██████'],
    '3': ['█████ ', '    ██', ' ████ ', '    ██', '█████ '],
    '4': ['██  ██', '██  ██', '██████', '    ██', '    ██'],
    '5': ['██████', '██    ', '█████ ', '    ██', '█████ '],
    '6': [' ████ ', '██    ', '█████ ', '██  ██', ' ████ '],
    '7': ['██████', '    ██', '   ██ ', '  ██  ', '  ██  '],
    '8': [' ████ ', '██  ██', ' ████ ', '██  ██', ' ████ '],
    '9': [' ████ ', '██  ██', ' █████', '    ██', ' ████ '],
    '-': ['      ', '      ', '██████', '      ', '      '],
    ' ': ['    ', '    ', '    ', '    ', '    ']
};

function renderBannerText(input: string): string {
    const clean = input.toUpperCase().slice(0, 14);
    const rows = ['', '', '', '', ''];

    for (const ch of clean) {
        const glyph = ASCII_FONT[ch] ?? ASCII_FONT[' '];
        for (let r = 0; r < 5; r++) {
            rows[r] += glyph[r] + '  ';
        }
    }
    return rows.join('\n');
}

export const visualCommands: CommandDefinition[] = [
    {
        name: 'theme',
        aliases: ['phosphor', 'color'],
        category: 'visual',
        description: 'Switch the CRT phosphor coating color palette.',
        usage: 'theme [green|amber|cyan|magenta|white]',
        examples: ['theme amber', 'theme cyan', 'theme'],
        execute: async ({ args, terminal }) => {
            if (args.length === 0) {
                const current = terminal.getThemePalette();
                await terminal.print(
                    `Active Phosphor: ${current.label} (${current.phosphorCode})`,
                                     { type: 'success' }
                );
                await terminal.print(`Available themes: ${VALID_THEMES.join(', ')}`, { type: 'system' });
                return;
            }

            const candidate = args[0].toLowerCase() as PhosphorTheme;
            if (!VALID_THEMES.includes(candidate)) {
                terminal.audio.playError();
                await terminal.print(
                    `Invalid phosphor "${args[0]}". Choose from: ${VALID_THEMES.join(', ')}`,
                                     { type: 'error' }
                );
                return;
            }

            terminal.setTheme(candidate);
            terminal.audio.playSuccess();
            const palette = terminal.getThemePalette(candidate);
            await terminal.print(`Phosphor recalibrated -> ${palette.label}`, { type: 'success' });
        }
    },

{
    name: 'crt',
    category: 'visual',
    description: 'Toggle CRT scanlines, aperture grille, and 60Hz flicker filters.',
    usage: 'crt [on|off|toggle]',
    execute: async ({ args, terminal }) => {
        const sub = (args[0] ?? 'toggle').toLowerCase();
        let state: boolean;
        if (sub === 'on') {
            state = terminal.toggleCRT(true);
        } else if (sub === 'off') {
            state = terminal.toggleCRT(false);
        } else {
            state = terminal.toggleCRT();
        }

        terminal.audio.playBeep(state ? 960 : 480, 70);
        await terminal.print(
            `CRT optical scanline & aperture filters: ${state ? 'ENABLED' : 'BYPASSED'}`,
            { type: state ? 'success' : 'warning' }
        );
    }
},

{
    name: 'degauss',
    category: 'visual',
    description: 'Discharge the electromagnetic degaussing coil around the CRT screen.',
    usage: 'degauss',
    execute: async ({ terminal }) => {
        terminal.triggerDegauss();
        await terminal.print(
            '⚡ MAGNETIC DEGAUSS COIL DISCHARGED // APERTURE GRILLE REALIGNED.',
            { type: 'warning' }
        );
    }
},

{
    name: 'glitch',
    category: 'visual',
    description: 'Inject a chromatic aberration signal interference burst.',
    usage: 'glitch [duration_ms]',
    execute: async ({ args, terminal }) => {
        const dur = Math.min(2000, Math.max(150, Number(args[0]) || 500));
        terminal.triggerGlitch(dur);
        await terminal.print(
            `[SIGNAL ANOMALY] Chromatic carrier desync injected (${dur}ms).`,
                             { type: 'warning' }
        );
    }
},

{
    name: 'matrix',
    aliases: ['rain'],
    category: 'visual',
    description: 'Launch real-time procedural Katakana digital rain on the Canvas layer.',
    usage: 'matrix [stop]',
    execute: async ({ args, terminal }) => {
        if (args[0]?.toLowerCase() === 'stop' || args[0]?.toLowerCase() === 'off') {
            terminal.stopCanvasMode();
            await terminal.print('Matrix digital rain shader halted.', { type: 'system' });
            return;
        }
        terminal.startCanvasMode('matrix');
        terminal.audio.playSuccess();
        await terminal.print(
            'Matrix digital rain shader active on #fx-canvas. Press Ctrl+C or run "fx stop" to halt.',
            { type: 'success' }
        );
    }
},

{
    name: 'scope',
    aliases: ['oscilloscope', 'wave'],
    category: 'visual',
    description: 'Launch real-time Web Audio API waveform oscilloscope on the Canvas layer.',
    usage: 'scope [stop]',
    execute: async ({ args, terminal }) => {
        if (args[0]?.toLowerCase() === 'stop' || args[0]?.toLowerCase() === 'off') {
            terminal.stopCanvasMode();
            await terminal.print('Oscilloscope shader halted.', { type: 'system' });
            return;
        }
        terminal.startCanvasMode('oscilloscope');
        terminal.audio.playSuccess();
        await terminal.print(
            'Live WebAudio harmonic oscilloscope active. Type keys or trigger sounds to modulate the beam!',
            { type: 'success' }
        );
    }
},

{
    name: 'starfield',
    aliases: ['warp'],
    category: 'visual',
    description: 'Launch 3D vector starfield projection on the Canvas layer.',
    usage: 'starfield [stop]',
    execute: async ({ args, terminal }) => {
        if (args[0]?.toLowerCase() === 'stop' || args[0]?.toLowerCase() === 'off') {
            terminal.stopCanvasMode();
            await terminal.print('Starfield projection halted.', { type: 'system' });
            return;
        }
        terminal.startCanvasMode('starfield');
        terminal.audio.playSuccess();
        await terminal.print('3D vector starfield warp simulation engaged.', { type: 'success' });
    }
},

{
    name: 'plasma',
    category: 'visual',
    description: 'Launch retro demoscene interference plasma field on the Canvas layer.',
    usage: 'plasma [stop]',
    execute: async ({ args, terminal }) => {
        if (args[0]?.toLowerCase() === 'stop' || args[0]?.toLowerCase() === 'off') {
            terminal.stopCanvasMode();
            await terminal.print('Plasma shader halted.', { type: 'system' });
            return;
        }
        terminal.startCanvasMode('plasma');
        terminal.audio.playSuccess();
        await terminal.print('Trigonometric scanline plasma shader engaged.', { type: 'success' });
    }
},

{
    name: 'fx',
    aliases: ['stopfx'],
    category: 'visual',
    description: 'Control or halt active HTML5 Canvas background shaders.',
    usage: 'fx <matrix|oscilloscope|starfield|plasma|stop>',
    execute: async ({ args, terminal }) => {
        const sub = (args[0] ?? 'stop').toLowerCase();
        if (sub === 'stop' || sub === 'off' || sub === 'none') {
            terminal.stopCanvasMode();
            await terminal.print('All Canvas shaders terminated.', { type: 'system' });
            return;
        }
        if (sub === 'matrix' || sub === 'oscilloscope' || sub === 'starfield' || sub === 'plasma') {
            terminal.startCanvasMode(sub);
            await terminal.print(`Canvas shader switched to: ${sub.toUpperCase()}`, {
                type: 'success'
            });
            return;
        }
        await terminal.print('Usage: fx <matrix|oscilloscope|starfield|plasma|stop>', {
            type: 'warning'
        });
    }
},

{
    name: 'audio',
    aliases: ['sound', 'mute'],
    category: 'visual',
    description: 'Configure the procedural Web Audio API synthesizer.',
    usage: 'audio [on|off|vol <0-100>|test]',
    examples: ['audio off', 'audio vol 75', 'audio test'],
    execute: async ({ args, terminal }) => {
        const sub = (args[0] ?? '').toLowerCase();

        if (!sub) {
            await terminal.print(
                `WebAudio Synth: ${terminal.audio.enabled ? 'ENABLED' : 'MUTED'} | Gain: ${Math.round(terminal.audio.volume * 100)}%`,
                                 { type: 'system' }
            );
            return;
        }

        if (sub === 'on') {
            terminal.audio.setEnabled(true);
            terminal.audio.playSuccess();
            await terminal.print('Procedural Web Audio synthesizer ENABLED.', { type: 'success' });
        } else if (sub === 'off' || sub === 'mute') {
            terminal.audio.setEnabled(false);
            await terminal.print('Procedural Web Audio synthesizer MUTED.', { type: 'warning' });
        } else if (sub === 'vol' || sub === 'volume') {
            const val = Number(args[1]);
            if (Number.isNaN(val) || val < 0 || val > 100) {
                await terminal.print('Usage: audio vol <0-100>', { type: 'error' });
                return;
            }
            terminal.audio.setVolume(val / 100);
            terminal.audio.playBeep(880, 70);
            await terminal.print(`Master synthesizer gain set to ${val}%.`, { type: 'success' });
        } else if (sub === 'test') {
            terminal.audio.setEnabled(true);
            terminal.audio.playBootChord();
            await terminal.print('Playing harmonic FM calibration chord...', { type: 'success' });
        } else {
            await terminal.print('Usage: audio [on|off|vol <0-100>|test]', { type: 'warning' });
        }
    }
},

{
    name: 'banner',
    aliases: ['logo'],
    category: 'visual',
    description: 'Render high-contrast block ASCII typography.',
    usage: 'banner <text>',
    examples: ['banner GHOST', 'banner ABASS'],
    execute: async ({ args, terminal }) => {
        const text = args.length > 0 ? args.join(' ') : 'GHOST SHELL';
        const art = renderBannerText(text);
        await terminal.print(art, { type: 'ascii' });
    }
}
];
