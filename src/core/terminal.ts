import {
    AudioController,
    CanvasEffectMode,
    CommandRegistryController,
    PhosphorTheme,
    PrintOptions,
    ShellState,
    TerminalController,
    ThemePalette,
    VirtualFile
} from '../types';

const HISTORY_STORAGE_KEY = 'ghost_shell_cmd_history_v1';

const THEME_PALETTES: Record<PhosphorTheme, ThemePalette> = {
    green: {
        id: 'green',
        label: 'P1 // WILLEMITE GREEN',
        phosphorCode: '525nm P1-SILICATE',
        primary: '#33ff66',
        secondary: '#16b846',
        dim: 'rgba(51, 255, 102, 0.25)',
        bg: '#041107'
    },
    amber: {
        id: 'amber',
        label: 'P3 // MONOCHROME AMBER',
        phosphorCode: '590nm P3-HALOPHOSPHATE',
        primary: '#ffb000',
        secondary: '#cc7a00',
        dim: 'rgba(255, 176, 0, 0.25)',
        bg: '#130b02'
    },
    cyan: {
        id: 'cyan',
        label: 'P4 // CYBERNETIC CYAN',
        phosphorCode: '485nm P4-CADMIUM',
        primary: '#00f0ff',
        secondary: '#00a3b8',
        dim: 'rgba(0, 240, 255, 0.25)',
        bg: '#021014'
    },
    magenta: {
        id: 'magenta',
        label: 'P7 // SYNTHWAVE MAGENTA',
        phosphorCode: '615nm P7-EUROPIUM',
        primary: '#ff33cc',
        secondary: '#c41498',
        dim: 'rgba(255, 51, 204, 0.25)',
        bg: '#140310'
    },
    white: {
        id: 'white',
        label: 'P45 // PAPER WHITE',
        phosphorCode: '545nm P45-YTTRIUM',
        primary: '#e6f2ff',
        secondary: '#99b3cc',
        dim: 'rgba(230, 242, 255, 0.25)',
        bg: '#0a0d12'
    }
};

function createInitialFileSystem(): Record<string, VirtualFile> {
    const now = '2026-11-01 13:14 UTC';
    const files: Array<Omit<VirtualFile, 'size'>> = [
        {
            name: 'manifesto.txt',
            permissions: '-rw-r--r--',
            updatedAt: now,
            content: [
                '============================================================',
                '                THE GHOST SHELL MANIFESTO                   ',
                '============================================================',
                'Operator Clearance: ABASS LE ROI DES BOBBYS [ROOT-00]',
                '',
                'We reject bloated frameworks and silent interfaces.',
                'Every keystroke resonates through copper coils and silicon.',
                'Every glyph burns into phosphor with deliberate permanence.',
                '',
                '1. Zero external dependencies. Pure mathematical synthesis.',
                '2. Direct hardware-level aesthetics in the browser.',
                '3. Total operator sovereignty over the command stream.'
            ].join('\n')
        },
        {
            name: 'ghost_protocol.md',
            permissions: '-rwxr-xr-x',
            updatedAt: now,
            content: [
                '# GHOST PROTOCOL // QUICK OPERATIONS MANUAL',
                '',
                '- Execute `sysinfo` for full hardware & phosphor diagnostics.',
                '- Execute `matrix`, `scope`, `starfield`, or `plasma` for live Canvas shaders.',
                '- Execute `theme <green|amber|cyan|magenta|white>` to switch CRT coating.',
                '- Execute `degauss` to discharge electromagnetic screen build-up.',
                '- Execute `scan` to probe encrypted relay nodes across the subnet.',
                '- Execute `calc "(128 * 4) + sqrt(1024)"` for instant math evaluation.'
            ].join('\n')
        },
        {
            name: 'net_nodes.log',
            permissions: '-rw-r-----',
            updatedAt: now,
            content: [
                '[13:02:11] UPLINK ESTABLISHED -> RABAT-CORE-01 (10.244.8.1) [1.4ms]',
                '[13:04:49] HANDSHAKE VERIFIED -> CASABLANCA-IX (10.244.19.4) [4.1ms]',
                '[13:08:15] CIPHER ROTATED     -> AES-512-GCM // ZERO PACKET LOSS',
                '[13:12:03] AUTHENTICATED      -> OPERATOR: Abass le roi des Bobbys'
            ].join('\n')
        },
        {
            name: 'security.key',
            permissions: '-r--------',
            updatedAt: now,
            content:
            '-----BEGIN GHOST SHELL QUANTUM KEY-----\n' +
            '47484F53 542D5348 454C4C2D 41424153\n' +
            '532D524F 492D4445 532D424F 42425953\n' +
            '9F8E7D6C 5B4A3928 1706F5E4 D3C2B1A0\n' +
            '-----END GHOST SHELL QUANTUM KEY-----'
        }
    ];

    const record: Record<string, VirtualFile> = {};
    for (const f of files) {
        record[f.name] = {
            ...f,
            size: new TextEncoder().encode(f.content).length
        };
    }
    return record;
}

export class GhostTerminal implements TerminalController {
    public readonly state: ShellState;
    public readonly audio: AudioController;
    public readonly registry: CommandRegistryController;

    // DOM Elements
    private chassisEl: HTMLElement;
    private screenEl: HTMLElement;
    private viewportEl: HTMLElement;
    private outputEl: HTMLElement;
    private promptEl: HTMLElement;
    private inputBeforeEl: HTMLElement;
    private cursorEl: HTMLElement;
    private inputAfterEl: HTMLElement;
    private suggestionEl: HTMLElement;
    private hiddenInputEl: HTMLInputElement;
    private canvasEl: HTMLCanvasElement;
    private canvasCtx: CanvasRenderingContext2D;

    // HUD Elements
    private hudCpuEl: HTMLElement;
    private hudMemEl: HTMLElement;
    private hudAudioEl: HTMLElement;
    private hudClockEl: HTMLElement;
    private hudFxEl: HTMLElement;

    // Input & History State
    private currentBuffer = '';
    private cursorPos = 0;
    private history: string[] = [];
    private historyIndex = -1;
    private isBusy = false;
    private abortController: AbortController | null = null;

    // Canvas Effect State
    private animFrameId: number | null = null;
    private matrixColumns: number[] = [];
    private stars: Array<{ x: number; y: number; z: number }> = [];
    private waveformBuffer = new Uint8Array(512);
    private frameTick = 0;

    constructor(audio: AudioController, registry: CommandRegistryController) {
        this.audio = audio;
        this.registry = registry;

        this.state = {
            user: 'abass',
            aliasTitle: 'Abass le roi des Bobbys',
            hostname: 'ghost-shell',
            cwd: '/home/abass',
            theme: 'green',
            audioEnabled: true,
            volume: 0.55,
            crtEffectsEnabled: true,
            poweredOn: true,
            activeCanvasEffect: 'none',
            bootTimestamp: Date.now(),
            env: {
                USER: 'Abass le roi des Bobbys',
                SHELL: '/bin/ghost',
                TERM: 'xterm-crt-256color',
                NODE_ID: 'NEON-7',
                CLEARANCE: 'LEVEL-9-SOVEREIGN'
            },
            fs: createInitialFileSystem()
        };

        this.chassisEl = this.requireElement('#crt-chassis');
        this.screenEl = this.requireElement('#crt-screen');
        this.viewportEl = this.requireElement('#terminal-viewport');
        this.outputEl = this.requireElement('#terminal-output');
        this.promptEl = this.requireElement('#terminal-prompt');
        this.inputBeforeEl = this.requireElement('#input-before');
        this.cursorEl = this.requireElement('#terminal-cursor');
        this.inputAfterEl = this.requireElement('#input-after');
        this.suggestionEl = this.requireElement('#input-ghost-suggestion');
        this.hiddenInputEl = this.requireElement('#terminal-hidden-input') as HTMLInputElement;
        this.canvasEl = this.requireElement('#fx-canvas') as HTMLCanvasElement;

        const ctx = this.canvasEl.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to initialize 2D context on #fx-canvas');
        }
        this.canvasCtx = ctx;

        this.hudCpuEl = this.requireElement('#hud-cpu');
        this.hudMemEl = this.requireElement('#hud-mem');
        this.hudAudioEl = this.requireElement('#hud-audio');
        this.hudClockEl = this.requireElement('#hud-clock');
        this.hudFxEl = this.requireElement('#hud-fx');

        this.loadHistory();
        this.bindEvents();
        this.resizeCanvas();
        this.startTelemetryLoop();
        this.renderInputLine();
    }

    private requireElement(selector: string): HTMLElement {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) {
            throw new Error(`Required DOM element missing: ${selector}`);
        }
        return el;
    }

    private loadHistory(): void {
        try {
            const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.history = parsed.filter((item): item is string => typeof item === 'string');
                }
            }
        } catch {
            this.history = [];
        }
    }

    private saveHistory(): void {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history.slice(-100)));
        } catch {
            // Ignore storage quota errors
        }
    }

    private bindEvents(): void {
        // Focus hidden input when clicking anywhere on the CRT screen
        this.screenEl.addEventListener('mousedown', () => {
            this.audio.init();
            setTimeout(() => {
                if (window.getSelection()?.toString().length === 0) {
                    this.hiddenInputEl.focus();
                }
            }, 10);
        });

        // Global keydown listener
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Paste listener
        window.addEventListener('paste', (e) => {
            if (!this.state.poweredOn || this.isBusy) return;
            const pasted = e.clipboardData?.getData('text');
            if (pasted) {
                e.preventDefault();
                const clean = pasted.replace(/[\r\n]+/g, ' ');
                this.insertTextAtCursor(clean);
                this.audio.playKeystroke('standard');
            }
        });

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private handleKeyDown(e: KeyboardEvent): void {
        this.audio.init();

        if (!this.state.poweredOn) {
            if (e.key === 'Enter' || e.key === ' ') {
                this.togglePower(true);
            }
            return;
        }

        // Ctrl+C: cancel active typewriter or stop canvas visualization
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            this.audio.playKeystroke('enter');
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }
            if (this.state.activeCanvasEffect !== 'none') {
                this.stopCanvasMode();
                void this.print('^C [CANVAS SHADER TERMINATED]', { type: 'warning' });
                return;
            }
            void this.print(`${this.getPromptString()} ${this.currentBuffer}^C`, { type: 'command' });
            this.currentBuffer = '';
            this.cursorPos = 0;
            this.renderInputLine();
            return;
        }

        // Ctrl+L: clear viewport
        if (e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            this.audio.playKeystroke('enter');
            this.clear();
            return;
        }

        // Ctrl+U: clear current line
        if (e.ctrlKey && e.key.toLowerCase() === 'u') {
            e.preventDefault();
            this.audio.playKeystroke('backspace');
            this.currentBuffer = '';
            this.cursorPos = 0;
            this.renderInputLine();
            return;
        }

        if (this.isBusy) {
            return;
        }

        if (e.metaKey || e.ctrlKey || e.altKey) {
            return;
        }

        switch (e.key) {
            case 'Enter': {
                e.preventDefault();
                this.audio.playKeystroke('enter');
                const line = this.currentBuffer;
                this.currentBuffer = '';
                this.cursorPos = 0;
                this.historyIndex = -1;
                this.renderInputLine();
                void this.executeLine(line);
                break;
            }

            case 'Backspace': {
                e.preventDefault();
                if (this.cursorPos > 0) {
                    this.currentBuffer =
                    this.currentBuffer.slice(0, this.cursorPos - 1) +
                    this.currentBuffer.slice(this.cursorPos);
                    this.cursorPos--;
                    this.audio.playKeystroke('backspace');
                    this.renderInputLine();
                } else {
                    this.audio.playBeep(220, 40);
                }
                break;
            }

            case 'Delete': {
                e.preventDefault();
                if (this.cursorPos < this.currentBuffer.length) {
                    this.currentBuffer =
                    this.currentBuffer.slice(0, this.cursorPos) +
                    this.currentBuffer.slice(this.cursorPos + 1);
                    this.audio.playKeystroke('backspace');
                    this.renderInputLine();
                }
                break;
            }

            case 'ArrowLeft': {
                e.preventDefault();
                if (this.cursorPos > 0) {
                    this.cursorPos--;
                    this.audio.playKeystroke('standard');
                    this.renderInputLine();
                }
                break;
            }

            case 'ArrowRight': {
                e.preventDefault();
                if (this.cursorPos < this.currentBuffer.length) {
                    this.cursorPos++;
                    this.audio.playKeystroke('standard');
                    this.renderInputLine();
                } else {
                    // Accept ghost autocomplete suggestion if at end of line
                    const suggestion = this.getInlineSuggestion();
                    if (suggestion) {
                        this.currentBuffer = suggestion;
                        this.cursorPos = this.currentBuffer.length;
                        this.audio.playKeystroke('space');
                        this.renderInputLine();
                    }
                }
                break;
            }

            case 'Home': {
                e.preventDefault();
                this.cursorPos = 0;
                this.audio.playKeystroke('standard');
                this.renderInputLine();
                break;
            }

            case 'End': {
                e.preventDefault();
                this.cursorPos = this.currentBuffer.length;
                this.audio.playKeystroke('standard');
                this.renderInputLine();
                break;
            }

            case 'ArrowUp': {
                e.preventDefault();
                if (this.history.length === 0) break;
                if (this.historyIndex === -1) {
                    this.historyIndex = this.history.length - 1;
                } else if (this.historyIndex > 0) {
                    this.historyIndex--;
                }
                this.currentBuffer = this.history[this.historyIndex] ?? '';
                this.cursorPos = this.currentBuffer.length;
                this.audio.playKeystroke('standard');
                this.renderInputLine();
                break;
            }

            case 'ArrowDown': {
                e.preventDefault();
                if (this.historyIndex === -1) break;
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.currentBuffer = this.history[this.historyIndex] ?? '';
                } else {
                    this.historyIndex = -1;
                    this.currentBuffer = '';
                }
                this.cursorPos = this.currentBuffer.length;
                this.audio.playKeystroke('standard');
                this.renderInputLine();
                break;
            }

            case 'Tab': {
                e.preventDefault();
                const matches = this.registry.autocomplete(
                    this.currentBuffer,
                    Object.keys(this.state.fs)
                );
                if (matches.length === 1) {
                    this.currentBuffer = matches[0] + (matches[0].includes(' ') ? '' : ' ');
                    this.cursorPos = this.currentBuffer.length;
                    this.audio.playKeystroke('space');
                    this.renderInputLine();
                } else if (matches.length > 1) {
                    this.audio.playBeep(660, 45);
                    void this.print(`${this.getPromptString()} ${this.currentBuffer}`, { type: 'command' });
                    void this.print(matches.join('   '), { type: 'system' });
                }
                break;
            }

            default: {
                if (e.key.length === 1) {
                    e.preventDefault();
                    this.insertTextAtCursor(e.key);
                    this.audio.playKeystroke(e.key === ' ' ? 'space' : 'standard');
                }
                break;
            }
        }
    }

    private insertTextAtCursor(text: string): void {
        this.currentBuffer =
        this.currentBuffer.slice(0, this.cursorPos) +
        text +
        this.currentBuffer.slice(this.cursorPos);
        this.cursorPos += text.length;
        this.renderInputLine();
        this.scrollToBottom();
    }

    private getInlineSuggestion(): string | null {
        if (!this.currentBuffer.trim()) return null;
        const matches = this.registry.autocomplete(this.currentBuffer, Object.keys(this.state.fs));
        if (matches.length > 0 && matches[0].toLowerCase().startsWith(this.currentBuffer.toLowerCase())) {
            return matches[0];
        }
        return null;
    }

    private renderInputLine(): void {
        this.promptEl.textContent = this.getPromptString();
        const before = this.currentBuffer.slice(0, this.cursorPos);
        const cursorChar = this.currentBuffer[this.cursorPos] ?? ' ';
        const after = this.currentBuffer.slice(this.cursorPos + 1);

        this.inputBeforeEl.textContent = before;
        this.cursorEl.textContent = cursorChar;
        this.inputAfterEl.textContent = after;

        const suggestion = this.getInlineSuggestion();
        if (suggestion && this.cursorPos === this.currentBuffer.length) {
            this.suggestionEl.textContent = suggestion.slice(this.currentBuffer.length);
        } else {
            this.suggestionEl.textContent = '';
        }
    }

    public getPromptString(): string {
        return `${this.state.user}@${this.state.hostname}:~$`;
    }

    public async executeLine(rawLine: string): Promise<void> {
        const trimmed = rawLine.trim();
        await this.print(`${this.getPromptString()} ${rawLine}`, { type: 'command' });

        if (!trimmed) {
            return;
        }

        if (this.history[this.history.length - 1] !== trimmed) {
            this.history.push(trimmed);
            this.saveHistory();
        }

        const parsed = this.registry.parse(trimmed);
        const definition = this.registry.get(parsed.commandName);

        if (!definition) {
            this.audio.playError();
            await this.print(`ghost-shell: command not found: "${parsed.commandName}"`, {
                type: 'error'
            });

            const similar = this.registry.findSimilar(parsed.commandName);
            if (similar) {
                await this.print(`Did you mean "${similar}"? Type "help" for a list of commands.`, {
                    type: 'system'
                });
            }
            return;
        }

        this.isBusy = true;
        try {
            await definition.execute({
                args: parsed.args,
                rawInput: parsed.rawInput,
                flags: parsed.flags,
                terminal: this,
                registry: this.registry
            });
        } catch (err) {
            this.audio.playError();
            const message = err instanceof Error ? err.message : String(err);
            await this.print(`Runtime fault in "${definition.name}": ${message}`, { type: 'error' });
        } finally {
            this.isBusy = false;
            this.renderInputLine();
            this.scrollToBottom();
        }
    }

    public async print(text: string, options: PrintOptions = {}): Promise<void> {
        const {
            type = 'standard',
            typewriter = false,
            speed = 10,
            playSound = true,
            className = ''
        } = options;

        const lineEl = document.createElement('div');
        lineEl.className = `term-line term-line-${type} ${className}`.trim();
        this.outputEl.appendChild(lineEl);

        if (!typewriter || speed <= 0) {
            lineEl.textContent = text;
            this.scrollToBottom();
            return;
        }

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        for (let i = 0; i < text.length; i++) {
            if (signal.aborted) {
                lineEl.textContent = text;
                break;
            }
            lineEl.textContent += text[i];
            if (playSound && i % 2 === 0 && text[i] !== ' ') {
                this.audio.playTypewriterTick();
            }
            this.scrollToBottom();
            await new Promise((resolve) => setTimeout(resolve, speed));
        }
    }

    public printRawHTML(html: string, className = ''): void {
        const wrapper = document.createElement('div');
        wrapper.className = `term-line ${className}`.trim();
        wrapper.innerHTML = html;
        this.outputEl.appendChild(wrapper);
        this.scrollToBottom();
    }

    public printTable(headers: string[], rows: string[][]): void {
        const table = document.createElement('table');
        table.className = 'term-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const h of headers) {
            const th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const row of rows) {
            const tr = document.createElement('tr');
            for (const cell of row) {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        this.outputEl.appendChild(table);
        this.scrollToBottom();
    }

    public clear(): void {
        this.outputEl.innerHTML = '';
        this.scrollToBottom();
    }

    public setTheme(theme: PhosphorTheme): void {
        this.state.theme = theme;
        this.chassisEl.setAttribute('data-theme', theme);
        this.state.env.THEME = theme.toUpperCase();
    }

    public cycleTheme(): PhosphorTheme {
        const order: PhosphorTheme[] = ['green', 'amber', 'cyan', 'magenta', 'white'];
        const idx = order.indexOf(this.state.theme);
        const next = order[(idx + 1) % order.length];
        this.setTheme(next);
        return next;
    }

    public getThemePalette(theme: PhosphorTheme = this.state.theme): ThemePalette {
        return THEME_PALETTES[theme];
    }

    public toggleCRT(force?: boolean): boolean {
        this.state.crtEffectsEnabled = force ?? !this.state.crtEffectsEnabled;
        this.chassisEl.setAttribute('data-crt', this.state.crtEffectsEnabled ? 'on' : 'off');
        return this.state.crtEffectsEnabled;
    }

    public togglePower(force?: boolean): boolean {
        const next = force ?? !this.state.poweredOn;
        this.state.poweredOn = next;
        this.chassisEl.setAttribute('data-power', next ? 'on' : 'off');
        this.audio.playPowerToggle(next);
        return next;
    }

    public triggerDegauss(): void {
        this.audio.playDegaussPulse();
        this.screenEl.classList.remove('is-degaussing');
        void this.screenEl.offsetWidth;
        this.screenEl.classList.add('is-degaussing');
        setTimeout(() => {
            this.screenEl.classList.remove('is-degaussing');
        }, 980);
    }

    public triggerGlitch(durationMs = 450): void {
        this.audio.playGlitchBurst(durationMs);
        this.screenEl.classList.add('is-glitching');
        setTimeout(() => {
            this.screenEl.classList.remove('is-glitching');
        }, durationMs);
    }

    public getHistory(): string[] {
        return [...this.history];
    }

    public clearHistory(): void {
        this.history = [];
        this.historyIndex = -1;
        localStorage.removeItem(HISTORY_STORAGE_KEY);
    }

    private scrollToBottom(): void {
        this.viewportEl.scrollTop = this.viewportEl.scrollHeight;
    }

    /* ========================================================================
     * HTML5 CANVAS PROCEDURAL SHADER ENGINE
     * ======================================================================== */

    private resizeCanvas(): void {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvasEl.width = Math.max(320, Math.floor(rect.width));
        this.canvasEl.height = Math.max(240, Math.floor(rect.height));

        const cols = Math.floor(this.canvasEl.width / 16);
        this.matrixColumns = Array.from({ length: cols }, () => Math.random() * -50);

        this.stars = Array.from({ length: 180 }, () => ({
            x: (Math.random() - 0.5) * this.canvasEl.width * 2,
                                                        y: (Math.random() - 0.5) * this.canvasEl.height * 2,
                                                        z: Math.random() * this.canvasEl.width
        }));
    }

    public startCanvasMode(mode: CanvasEffectMode): void {
        this.stopCanvasMode();
        if (mode === 'none') return;

        this.state.activeCanvasEffect = mode;
        this.hudFxEl.textContent = `FX: ${mode.toUpperCase()}`;
        this.resizeCanvas();

        const renderLoop = (): void => {
            if (this.state.activeCanvasEffect === 'none') return;
            this.frameTick++;

            switch (this.state.activeCanvasEffect) {
                case 'matrix':
                    this.renderMatrixFrame();
                    break;
                case 'oscilloscope':
                    this.renderOscilloscopeFrame();
                    break;
                case 'starfield':
                    this.renderStarfieldFrame();
                    break;
                case 'plasma':
                    this.renderPlasmaFrame();
                    break;
            }

            this.animFrameId = requestAnimationFrame(renderLoop);
        };

        this.animFrameId = requestAnimationFrame(renderLoop);
    }

    public stopCanvasMode(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.state.activeCanvasEffect = 'none';
        this.hudFxEl.textContent = 'FX: IDLE';
        this.canvasCtx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }

    private renderMatrixFrame(): void {
        const ctx = this.canvasCtx;
        const { width, height } = this.canvasEl;
        const palette = this.getThemePalette();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = palette.primary;
        ctx.font = '15px monospace';

        const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF';
        for (let i = 0; i < this.matrixColumns.length; i++) {
            const char = glyphs[Math.floor(Math.random() * glyphs.length)];
            const x = i * 16;
            const y = this.matrixColumns[i] * 16;

            ctx.fillText(char, x, y);

            if (y > height && Math.random() > 0.975) {
                this.matrixColumns[i] = 0;
            }
            this.matrixColumns[i] += 0.65;
        }
    }

    private renderOscilloscopeFrame(): void {
        const ctx = this.canvasCtx;
        const { width, height } = this.canvasEl;
        const palette = this.getThemePalette();

        ctx.clearRect(0, 0, width, height);

        // Draw Oscilloscope Graticule Grid
        ctx.strokeStyle = palette.dim;
        ctx.lineWidth = 1;
        const step = 48;
        ctx.beginPath();
        for (let x = 0; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Fetch live Web Audio API waveform + synthesize carrier harmonic
        this.audio.getWaveformData(this.waveformBuffer);

        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const sliceWidth = width / this.waveformBuffer.length;
        let x = 0;

        for (let i = 0; i < this.waveformBuffer.length; i++) {
            const audioSample = (this.waveformBuffer[i] - 128) / 128;
            const carrier =
            Math.sin(i * 0.045 + this.frameTick * 0.07) * 0.18 +
            Math.cos(i * 0.02 - this.frameTick * 0.04) * 0.1;

            const combined = audioSample * 1.9 + carrier;
            const y = height / 2 + combined * (height * 0.28);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    private renderStarfieldFrame(): void {
        const ctx = this.canvasCtx;
        const { width, height } = this.canvasEl;
        const palette = this.getThemePalette();
        const cx = width / 2;
        const cy = height / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = palette.primary;
        ctx.strokeStyle = palette.secondary;

        for (const star of this.stars) {
            star.z -= 6.5;
            if (star.z <= 1) {
                star.x = (Math.random() - 0.5) * width * 2;
                star.y = (Math.random() - 0.5) * height * 2;
                star.z = width;
            }

            const sx = cx + (star.x / star.z) * (width * 0.6);
            const sy = cy + (star.y / star.z) * (height * 0.6);
            const radius = Math.max(0.6, (1 - star.z / width) * 3.2);

            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private renderPlasmaFrame(): void {
        const ctx = this.canvasCtx;
        const { width, height } = this.canvasEl;
        const palette = this.getThemePalette();

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = palette.primary;

        const cell = 18;
        const t = this.frameTick * 0.045;

        for (let y = 0; y < height; y += cell) {
            for (let x = 0; x < width; x += cell) {
                const v =
                Math.sin(x * 0.015 + t) +
                Math.sin(y * 0.015 + t * 0.8) +
                Math.sin((x + y) * 0.01 + t * 1.2) +
                Math.sin(Math.hypot(x - width / 2, y - height / 2) * 0.018 - t);

                const norm = (v + 4) / 8;
                if (norm > 0.52) {
                    ctx.globalAlpha = (norm - 0.5) * 0.65;
                    ctx.fillRect(x, y, cell - 3, cell - 3);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    /* ========================================================================
     * TELEMETRY LOOP & BOOT SEQUENCE
     * ======================================================================== */

    private startTelemetryLoop(): void {
        const updateHud = (): void => {
            const now = new Date();
            const timeStr = now.toISOString().slice(11, 19) + ' UTC';
            this.hudClockEl.textContent = timeStr;

            const baseCpu = this.state.activeCanvasEffect === 'none' ? 4 : 24;
            const cpuJitter = Math.floor(Math.random() * 5);
            const cpuVal = String(baseCpu + cpuJitter).padStart(2, '0');
            this.hudCpuEl.textContent = `CPU: ${cpuVal}%`;

            const fileCount = Object.keys(this.state.fs).length;
            this.hudMemEl.textContent = `VFS: ${fileCount}F`;
            this.hudAudioEl.textContent = `SND: ${this.audio.enabled ? 'ON' : 'MUTE'}`;
        };

        updateHud();
        setInterval(updateHud, 1000);
    }

    public async reboot(): Promise<void> {
        this.isBusy = true;
        this.stopCanvasMode();
        this.clear();
        this.audio.playBootChord();

        const bootLines = [
            'GHOST//BIOS v4.9.2-ROM (c) CYBERNETIC SYSTEMS DIVISION',
            'VERIFYING HIGH-VOLTAGE CATHODE TUBE .............. [OK]',
            'CALIBRATING P1/P3/P4 PHOSPHOR DEFLECTION COILS ... [OK]',
            'INITIALIZING PROCEDURAL WEB AUDIO SYNTHESIZER .... [OK]',
            'MOUNTING ZERO-DEPENDENCY VIRTUAL FILESYSTEM ...... [OK]',
            `AUTHENTICATING SOVEREIGN OPERATOR: ${this.state.aliasTitle.toUpperCase()} ... [GRANTED]`
        ];

        for (const line of bootLines) {
            await this.print(line, { type: 'system', typewriter: true, speed: 6 });
        }

        const asciiCrest = [
            '   ______ __  __ ____   _____ ______   _____ __  __ ______ __     __ ',
            '  / ____// / / // __ \\ / ___//_  __/  / ___// / / // ____// /    / / ',
            ' / / __ / /_/ // / / / \\__ \\  / /     \\__ \\/ /_/ // __/  / /    / /  ',
            '/ /_/ // __  // /_/ / ___/ / / /     ___/ / __  // /___ / /___ / /___',
            '\\____//_/ /_/ \\____/ /____/ /_/     /____/_/ /_//_____//_____//_____/'
        ].join('\n');

        await this.print(asciiCrest, { type: 'ascii' });
        await this.print(
            `Welcome back, ${this.state.aliasTitle}. Ghost Shell is online and awaiting your command.`,
            { type: 'success' }
        );
        await this.print(
            'Type "help" to inspect available commands, "sysinfo" for diagnostics, or "matrix" for visual shaders.',
            { type: 'system' }
        );

        this.isBusy = false;
        this.renderInputLine();
        this.hiddenInputEl.focus();
    }
}
