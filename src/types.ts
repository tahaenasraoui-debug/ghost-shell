export type PhosphorTheme = 'green' | 'amber' | 'cyan' | 'magenta' | 'white';

export type CanvasEffectMode = 'none' | 'matrix' | 'oscilloscope' | 'starfield' | 'plasma';

export type LineType =
| 'standard'
| 'system'
| 'error'
| 'success'
| 'warning'
| 'ascii'
| 'command';

export interface ThemePalette {
    id: PhosphorTheme;
    label: string;
    phosphorCode: string;
    primary: string;
    secondary: string;
    dim: string;
    bg: string;
}

export interface PrintOptions {
    type?: LineType;
    typewriter?: boolean;
    speed?: number;
    playSound?: boolean;
    className?: string;
}

export interface VirtualFile {
    name: string;
    content: string;
    permissions: string;
    updatedAt: string;
    size: number;
}

export interface ShellState {
    user: string;
    aliasTitle: string;
    hostname: string;
    cwd: string;
    theme: PhosphorTheme;
    audioEnabled: boolean;
    volume: number;
    crtEffectsEnabled: boolean;
    poweredOn: boolean;
    activeCanvasEffect: CanvasEffectMode;
    bootTimestamp: number;
    env: Record<string, string>;
    fs: Record<string, VirtualFile>;
}

export type KeySoundVariant = 'standard' | 'space' | 'enter' | 'backspace';

export interface AudioController {
    readonly enabled: boolean;
    readonly volume: number;
    init(): void;
    setEnabled(enabled: boolean): boolean;
    setVolume(level: number): void;
    playKeystroke(variant?: KeySoundVariant): void;
    playTypewriterTick(): void;
    playBootChord(): void;
    playDegaussPulse(): void;
    playBeep(freq?: number, durationMs?: number): void;
    playError(): void;
    playSuccess(): void;
    playGlitchBurst(durationMs?: number): void;
    playPowerToggle(turningOn: boolean): void;
    getWaveformData(targetBuffer: Uint8Array): void;
}

export interface ParsedCommandInput {
    commandName: string;
    args: string[];
    flags: Record<string, string | boolean>;
    rawInput: string;
}

export interface CommandContext {
    args: string[];
    rawInput: string;
    flags: Record<string, string | boolean>;
    terminal: TerminalController;
    registry: CommandRegistryController;
}

export type CommandCategory = 'system' | 'visual' | 'utility';

export interface CommandFlagDefinition {
    long?: string;
    short?: string;
    takesValue?: boolean;
}

export interface CommandDefinition {
    name: string;
    aliases?: string[];
    category: CommandCategory;
    description: string;
    usage: string;
    examples?: string[];
    supportedFlags?: CommandFlagDefinition[];
    execute: (ctx: CommandContext) => Promise<void> | void;
}

export interface CommandRegistryController {
    register(definition: CommandDefinition): void;
    registerMany(definitions: CommandDefinition[]): void;
    get(name: string): CommandDefinition | undefined;
    getAll(): CommandDefinition[];
    getByCategory(category: CommandCategory): CommandDefinition[];
    parse(rawInput: string): ParsedCommandInput;
    autocomplete(partialInput: string, fileNames: string[]): string[];
    findSimilar(inputName: string): string | null;
}

export interface TerminalController {
    readonly state: ShellState;
    readonly audio: AudioController;
    readonly registry: CommandRegistryController;
    readonly isAborted: boolean;
    print(text: string, options?: PrintOptions): Promise<void>;
    printRawHTML(html: string, className?: string): void;
    printTable(headers: string[], rows: string[][]): void;
    clear(): void;
    setTheme(theme: PhosphorTheme): void;
    cycleTheme(): PhosphorTheme;
    toggleCRT(force?: boolean): boolean;
    togglePower(force?: boolean): boolean;
    setAudioEnabled(enabled: boolean): boolean;
    setAudioVolume(level: number): void;
    triggerDegauss(): void;
    triggerGlitch(durationMs?: number): void;
    startCanvasMode(mode: CanvasEffectMode): void;
    stopCanvasMode(): void;
    getHistory(): string[];
    clearHistory(): void;
    getPromptString(): string;
    getThemePalette(theme?: PhosphorTheme): ThemePalette;
    reboot(): Promise<void>;
    executeLine(rawLine: string): Promise<void>;
}
