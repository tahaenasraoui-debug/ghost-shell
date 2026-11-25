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

describe('GhostTerminal integration & bug-fix verification', () => {
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

    it('uses consistent king operator identity across state, prompt, and CLI commands', async () => {
        expect(terminal.state.user).toBe('king');
        expect(terminal.state.cwd).toBe('/home/king');
        expect(terminal.state.env.USER).toBe('king');
        expect(terminal.getPromptString()).toBe('king@ghost-shell:~$');

        await terminal.executeLine('whoami');
        const out = document.querySelector('#terminal-output')?.textContent ?? '';
        expect(out).toContain('uid=0(king)');
        expect(out.toLowerCase()).not.toContain('abass');
    });

    it('handles mobile input and IME composition events on #terminal-hidden-input and clears it', async () => {
        const hiddenInput = document.querySelector<HTMLInputElement>('#terminal-hidden-input')!;
        const inputBefore = document.querySelector('#input-before')!;

        // Simulate mobile virtual keyboard typing
        hiddenInput.value = 'echo';
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(hiddenInput.value).toBe('');
        expect(inputBefore.textContent).toBe('echo');

        // Simulate IME composition: intermediate input events should not commit until compositionend
        hiddenInput.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        hiddenInput.value = ' k';
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(inputBefore.textContent).toBe('echo');

        hiddenInput.value = ' king';
        hiddenInput.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true, data: ' king' })
        );
        expect(hiddenInput.value).toBe('');
        expect(inputBefore.textContent).toBe('echo king');

        // Simulate Firefox trailing input event after compositionend when input was already cleared
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(inputBefore.textContent).toBe('echo king');

        // Simulate mobile virtual keyboard Backspace via beforeinput when hiddenInput is empty
        hiddenInput.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'deleteContentBackward'
            })
        );
        expect(inputBefore.textContent).toBe('echo kin');

        // Re-insert 'g' via mobile input event and execute
        hiddenInput.value = 'g';
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(inputBefore.textContent).toBe('echo king');

        // Execute the composed command via Enter
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((resolveTimer) => setTimeout(resolveTimer, 10));
        expect(document.querySelector('#terminal-output')?.textContent).toContain('king');
    });

    it('syncs bezel button .active states and ShellState on CLI commands and keyboard wake', async () => {
        const btnAudio = document.querySelector('#btn-audio')!;
        const btnCrt = document.querySelector('#btn-crt')!;
        const btnPower = document.querySelector('#btn-power')!;
        const hudAudio = document.querySelector('#hud-audio')!;

        // CLI audio off / on / vol
        await terminal.executeLine('audio off');
        expect(terminal.state.audioEnabled).toBe(false);
        expect(btnAudio.classList.contains('active')).toBe(false);
        expect(hudAudio.textContent).toBe('SND: MUTE');

        await terminal.executeLine('audio on');
        expect(terminal.state.audioEnabled).toBe(true);
        expect(btnAudio.classList.contains('active')).toBe(true);
        expect(hudAudio.textContent).toBe('SND: ON');

        await terminal.executeLine('audio vol 80');
        expect(terminal.state.volume).toBeCloseTo(0.8, 5);

        await terminal.executeLine('audio off');
        expect(btnAudio.classList.contains('active')).toBe(false);
        await terminal.executeLine('audio test');
        expect(terminal.state.audioEnabled).toBe(true);
        expect(btnAudio.classList.contains('active')).toBe(true);
        expect(hudAudio.textContent).toBe('SND: ON');

        // CLI crt off / on / toggle
        await terminal.executeLine('crt off');
        expect(terminal.state.crtEffectsEnabled).toBe(false);
        expect(btnCrt.classList.contains('active')).toBe(false);

        await terminal.executeLine('crt toggle');
        expect(terminal.state.crtEffectsEnabled).toBe(true);
        expect(btnCrt.classList.contains('active')).toBe(true);

        // Power off then wake via Space / Enter
        terminal.togglePower(false);
        expect(terminal.state.poweredOn).toBe(false);
        expect(btnPower.classList.contains('active')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(terminal.state.poweredOn).toBe(true);
        expect(btnPower.classList.contains('active')).toBe(true);

        terminal.togglePower(false);
        expect(btnPower.classList.contains('active')).toBe(false);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(terminal.state.poweredOn).toBe(true);
        expect(btnPower.classList.contains('active')).toBe(true);
    });

    it('cleanly cancels multi-line async output loops (scan and reboot) on Ctrl+C', async () => {
        // Cancel scan() mid-execution
        const scanPromise = terminal.executeLine('scan');
        await new Promise((r) => setTimeout(r, 25));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
        );
        await scanPromise;

        const scanOut = document.querySelector('#terminal-output')?.textContent ?? '';
        expect(scanOut).toContain('^C [COMMAND ABORTED]');
        expect(scanOut).not.toContain('Sweep complete: 4/4 nodes responsive');

        // Verify terminal accepts new commands immediately after cancellation
        await terminal.executeLine('echo -foo');
        expect(document.querySelector('#terminal-output')?.textContent).toContain('-foo');

        await terminal.executeLine('echo --typewriter "Signal Locked"');
        expect(document.querySelector('#terminal-output')?.textContent).toContain('Signal Locked');

        // Cancel reboot() mid-execution
        const rebootPromise = terminal.reboot();
        await new Promise((r) => setTimeout(r, 25));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
        );
        await rebootPromise;

        const rebootOut = document.querySelector('#terminal-output')?.textContent ?? '';
        expect(rebootOut).toContain('^C [COMMAND ABORTED]');
        expect(rebootOut).not.toContain('Welcome back');
    });
});
