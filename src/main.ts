import './effects/crt.css';
import { SoundEngine } from './core/audio';
import { CommandRegistry } from './core/commandRegistry';
import { GhostTerminal } from './core/terminal';
import { systemCommands } from './commands/system';
import { visualCommands } from './commands/visual';
import { utilityCommands } from './commands/utility';

function bootstrapGhostShell(): void {
    const audio = new SoundEngine();
    const registry = new CommandRegistry();

    registry.registerMany(systemCommands);
    registry.registerMany(visualCommands);
    registry.registerMany(utilityCommands);

    const terminal = new GhostTerminal(audio, registry);

    // Wire physical CRT monitor bezel controls
    const btnDegauss = document.querySelector<HTMLButtonElement>('#btn-degauss');
    const btnTheme = document.querySelector<HTMLButtonElement>('#btn-theme');
    const btnCrt = document.querySelector<HTMLButtonElement>('#btn-crt');
    const btnAudio = document.querySelector<HTMLButtonElement>('#btn-audio');
    const btnPower = document.querySelector<HTMLButtonElement>('#btn-power');

    btnDegauss?.addEventListener('click', () => {
        audio.init();
        terminal.triggerDegauss();
    });

    btnTheme?.addEventListener('click', () => {
        audio.init();
        const nextTheme = terminal.cycleTheme();
        audio.playBeep(780, 50);
        const palette = terminal.getThemePalette(nextTheme);
        void terminal.print(`[BEZEL SWITCH] Phosphor mode -> ${palette.label}`, {
            type: 'system'
        });
    });

    btnCrt?.addEventListener('click', () => {
        audio.init();
        const active = terminal.toggleCRT();
        btnCrt.classList.toggle('active', active);
        audio.playBeep(active ? 920 : 440, 50);
    });

    btnAudio?.addEventListener('click', () => {
        audio.init();
        const nextState = audio.setEnabled(!audio.enabled);
        btnAudio.classList.toggle('active', nextState);
        if (nextState) {
            audio.playSuccess();
        }
    });

    btnPower?.addEventListener('click', () => {
        audio.init();
        const powered = terminal.togglePower();
        btnPower.classList.toggle('active', powered);
    });

    // Launch initial BIOS and kernel sequence
    void terminal.reboot();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapGhostShell);
} else {
    bootstrapGhostShell();
}
