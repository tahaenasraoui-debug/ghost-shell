// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundEngine } from '../src/core/audio';
import { CommandRegistry } from '../src/core/commandRegistry';
import { GhostTerminal } from '../src/core/terminal';
import { systemCommands } from '../src/commands/system';
import { visualCommands } from '../src/commands/visual';
import { utilityCommands } from '../src/commands/utility';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');

function createMockCanvasContext(): CanvasRenderingContext2D {
    return {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        font: '',
        lineWidth: 1,
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1
    } as unknown as CanvasRenderingContext2D;
}

describe('Virtual Filesystem (VFS) operations', () => {
    let terminal: GhostTerminal;

    beforeEach(() => {
        document.documentElement.innerHTML = indexHtml;
        window.localStorage?.clear();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
            () => createMockCanvasContext() as unknown as RenderingContext
        );

        const audio = new SoundEngine();
        const registry = new CommandRegistry();
        registry.registerMany(systemCommands);
        registry.registerMany(visualCommands);
        registry.registerMany(utilityCommands);
        terminal = new GhostTerminal(audio, registry);
    });

    afterEach(() => {
        terminal?.destroy();
        vi.restoreAllMocks();
    });

    it('initializes default virtual files with accurate UTF-8 sizes and king operator identity', () => {
        const files = terminal.state.fs;
        expect(Object.keys(files)).toEqual([
            'manifesto.txt',
            'ghost_protocol.md',
            'net_nodes.log',
            'security.key'
        ]);

        for (const file of Object.values(files)) {
            expect(file.size).toBe(new TextEncoder().encode(file.content).length);
            expect(file.content.toLowerCase()).not.toContain('abass');
        }
        expect(files['manifesto.txt'].content).toContain('KING');
        expect(files['net_nodes.log'].content).toContain('KING');
    });

    it('creates and overwrites files with "write" and computes UTF-8 byte sizes', async () => {
        await terminal.executeLine('write telemetry.txt "Signal nominal ⚡"');
        const created = terminal.state.fs['telemetry.txt'];
        expect(created).toBeDefined();
        expect(created.content).toBe('Signal nominal ⚡');
        expect(created.size).toBe(new TextEncoder().encode('Signal nominal ⚡').length);
        expect(created.permissions).toBe('-rw-r--r--');

        await terminal.executeLine('write telemetry.txt "Updated payload"');
        expect(terminal.state.fs['telemetry.txt'].content).toBe('Updated payload');
        expect(terminal.state.fs['telemetry.txt'].size).toBe(15);

        await terminal.executeLine('touch empty.log');
        expect(terminal.state.fs['empty.log'].content).toBe('');
        expect(terminal.state.fs['empty.log'].size).toBe(0);
    });

    it('reads files via "cat" and reports errors on missing files or arguments', async () => {
        await terminal.executeLine('write probe.txt "Sector 7 online"');
        await terminal.executeLine('cat probe.txt');
        const outputText = document.querySelector('#terminal-output')?.textContent ?? '';
        expect(outputText).toContain('Sector 7 online');

        await terminal.executeLine('cat missing_file.txt');
        expect(document.querySelector('#terminal-output')?.textContent).toContain(
            'cat: missing_file.txt: No such file in virtual storage'
        );

        await terminal.executeLine('cat');
        expect(document.querySelector('#terminal-output')?.textContent).toContain(
            'Usage: cat <filename>'
        );
    });

    it('lists files with "ls" and deletes files with "rm"', async () => {
        await terminal.executeLine('ls');
        const tableRows = document.querySelectorAll('#terminal-output table tbody tr');
        expect(tableRows.length).toBe(4);

        await terminal.executeLine('rm manifesto.txt');
        expect(terminal.state.fs['manifesto.txt']).toBeUndefined();
        expect(document.querySelector('#terminal-output')?.textContent).toContain(
            'Removed "manifesto.txt" from virtual storage.'
        );

        await terminal.executeLine('rm manifesto.txt');
        expect(document.querySelector('#terminal-output')?.textContent).toContain(
            'rm: cannot remove "manifesto.txt": No such file'
        );

        for (const name of Object.keys(terminal.state.fs)) {
            await terminal.executeLine(`rm ${name}`);
        }
        await terminal.executeLine('ls');
        expect(document.querySelector('#terminal-output')?.textContent).toContain(
            'Directory is empty.'
        );
    });
});
