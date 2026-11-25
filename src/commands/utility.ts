import { CommandDefinition } from '../types';

/**
 * Safe Recursive-Descent Mathematical Expression Evaluator (Zero eval())
 * Supports +, -, *, /, %, ^, parentheses, and functions: sin, cos, tan, sqrt, abs, log, pi, e
 */
class SafeMathEvaluator {
    private pos = 0;
    private input = '';

    public evaluate(expr: string): number {
        this.input = expr.replace(/\s+/g, '');
        this.pos = 0;
        if (!this.input) throw new Error('Empty expression');
        const result = this.parseExpression();
        if (this.pos < this.input.length) {
            throw new Error(`Unexpected token '${this.input[this.pos]}' at position ${this.pos}`);
        }
        return result;
    }

    private parseExpression(): number {
        let left = this.parseTerm();
        while (this.pos < this.input.length) {
            const op = this.input[this.pos];
            if (op === '+' || op === '-') {
                this.pos++;
                const right = this.parseTerm();
                left = op === '+' ? left + right : left - right;
            } else {
                break;
            }
        }
        return left;
    }

    private parseTerm(): number {
        let left = this.parsePower();
        while (this.pos < this.input.length) {
            const op = this.input[this.pos];
            if (op === '*' || op === '/' || op === '%') {
                this.pos++;
                const right = this.parsePower();
                if ((op === '/' || op === '%') && right === 0) {
                    throw new Error('Division by zero');
                }
                if (op === '*') left *= right;
                else if (op === '/') left /= right;
                else left %= right;
            } else {
                break;
            }
        }
        return left;
    }

    private parsePower(): number {
        const base = this.parseUnary();
        if (this.pos < this.input.length && this.input[this.pos] === '^') {
            this.pos++;
            const exponent = this.parsePower();
            return Math.pow(base, exponent);
        }
        return base;
    }

    private parseUnary(): number {
        if (this.input[this.pos] === '+') {
            this.pos++;
            return this.parseUnary();
        }
        if (this.input[this.pos] === '-') {
            this.pos++;
            return -this.parseUnary();
        }
        return this.parsePrimary();
    }

    private parsePrimary(): number {
        if (this.input[this.pos] === '(') {
            this.pos++;
            const val = this.parseExpression();
            if (this.input[this.pos] !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            this.pos++;
            return val;
        }

        // Identifier / Function / Constant
        if (/[a-zA-Z]/.test(this.input[this.pos] ?? '')) {
            const start = this.pos;
            while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
                this.pos++;
            }
            const name = this.input.slice(start, this.pos).toLowerCase();

            if (name === 'pi') return Math.PI;
            if (name === 'e') return Math.E;

            if (this.input[this.pos] !== '(') {
                throw new Error(`Unknown constant '${name}'`);
            }
            this.pos++; // consume '('
            const arg = this.parseExpression();
            if (this.input[this.pos] !== ')') {
                throw new Error(`Missing closing parenthesis for ${name}()`);
            }
            this.pos++;

            switch (name) {
                case 'sqrt':
                    return Math.sqrt(arg);
                case 'sin':
                    return Math.sin(arg);
                case 'cos':
                    return Math.cos(arg);
                case 'tan':
                    return Math.tan(arg);
                case 'abs':
                    return Math.abs(arg);
                case 'log':
                    return Math.log10(arg);
                case 'ln':
                    return Math.log(arg);
                case 'round':
                    return Math.round(arg);
                default:
                    throw new Error(`Unsupported function '${name}'`);
            }
        }

        // Number literal
        const start = this.pos;
        while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
            this.pos++;
        }
        const numStr = this.input.slice(start, this.pos);
        const num = Number(numStr);
        if (!numStr || Number.isNaN(num)) {
            throw new Error(`Invalid numeric token near '${this.input.slice(this.pos)}'`);
        }
        return num;
    }
}

function rot13(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
}

function formatHexDump(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const lines: string[] = [];

    for (let offset = 0; offset < bytes.length; offset += 16) {
        const chunk = bytes.slice(offset, offset + 16);
        const addr = offset.toString(16).padStart(8, '0').toUpperCase();

        const hexCols: string[] = [];
        let asciiCol = '';

        for (let i = 0; i < 16; i++) {
            if (i < chunk.length) {
                const b = chunk[i];
                hexCols.push(b.toString(16).padStart(2, '0').toUpperCase());
                asciiCol += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
            } else {
                hexCols.push('  ');
                asciiCol += ' ';
            }
        }

        const leftHex = hexCols.slice(0, 8).join(' ');
        const rightHex = hexCols.slice(8).join(' ');
        lines.push(`${addr}  ${leftHex}  ${rightHex}  |${asciiCol}|`);
    }

    return lines.join('\n');
}

export const utilityCommands: CommandDefinition[] = [
    {
        name: 'echo',
        aliases: ['print'],
        category: 'utility',
        description: 'Print text with environment variable expansion ($USER, $THEME, etc.).',
        usage: 'echo [-t|--typewriter] <text...>',
        examples: ['echo Welcome $USER', 'echo --typewriter "Wake up, Operator..."'],
        supportedFlags: [{ long: 'typewriter', short: 't', takesValue: false }],
        execute: async ({ args, flags, terminal }) => {
            const raw = args.join(' ');
            const expanded = raw.replace(/\$([A-Z0-9_]+)/gi, (_, key: string) => {
                const upper = key.toUpperCase();
                return terminal.state.env[upper] ?? `$${key}`;
            });

            const useTypewriter = Boolean(flags.typewriter || flags.t);
            await terminal.print(expanded, {
                type: 'standard',
                typewriter: useTypewriter,
                speed: 18
            });
        }
    },

{
    name: 'date',
    aliases: ['time', 'uptime'],
    category: 'utility',
    description: 'Display current UTC/Local telemetry timestamps and system uptime.',
    usage: 'date',
    execute: async ({ terminal }) => {
        const now = new Date();
        const upSec = ((Date.now() - terminal.state.bootTimestamp) / 1000).toFixed(2);
        await terminal.print(`LOCAL TIME : ${now.toString()}`);
        await terminal.print(`UTC ISO    : ${now.toISOString()}`);
        await terminal.print(`UNIX EPOCH : ${Math.floor(now.getTime() / 1000)}s | SESSION UPTIME: ${upSec}s`, {
            type: 'system'
        });
    }
},

{
    name: 'calc',
    aliases: ['math'],
    category: 'utility',
    description: 'Evaluate mathematical expressions safely (supports +, -, *, /, ^, sqrt, sin, cos, pi).',
    usage: 'calc <expression>',
    examples: ['calc "(128 * 4) + sqrt(1024)"', 'calc "2 ^ 16"', 'calc "sin(pi / 2)"'],
    execute: async ({ args, terminal }) => {
        if (args.length === 0) {
            terminal.audio.playError();
            await terminal.print('Usage: calc <expression>', { type: 'error' });
            return;
        }

        const expr = args.join(' ');
        const evaluator = new SafeMathEvaluator();
        try {
            const result = evaluator.evaluate(expr);
            const hex = Number.isInteger(result) && result >= 0 ? ` (0x${result.toString(16).toUpperCase()})` : '';
            terminal.audio.playSuccess();
            await terminal.print(`${expr} = ${result}${hex}`, { type: 'success' });
        } catch (err) {
            terminal.audio.playError();
            const msg = err instanceof Error ? err.message : String(err);
            await terminal.print(`Math syntax error: ${msg}`, { type: 'error' });
        }
    }
},

{
    name: 'hash',
    aliases: ['crypto', 'encode'],
    category: 'utility',
    description: 'Transform text using SHA-256, Base64, Hex, Binary, or ROT13.',
    usage: 'hash <sha256|base64|hex|rot13|binary> <text>',
    examples: ['hash sha256 "Ghost Shell"', 'hash base64 "KING"'],
    supportedFlags: [],
    execute: async ({ args, terminal }) => {
        if (args.length < 2) {
            terminal.audio.playError();
            await terminal.print('Usage: hash <sha256|base64|hex|rot13|binary> <text>', {
                type: 'error'
            });
            return;
        }

        const mode = args[0].toLowerCase();
        const payload = args.slice(1).join(' ');
        const bytes = new TextEncoder().encode(payload);

        switch (mode) {
            case 'sha256': {
                const digest = await crypto.subtle.digest('SHA-256', bytes);
                const hex = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
                await terminal.print(`SHA-256 : ${hex}`, { type: 'success' });
                break;
            }
            case 'base64': {
                const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
                await terminal.print(`BASE64  : ${btoa(binString)}`, { type: 'success' });
                break;
            }
            case 'hex': {
                const hex = Array.from(bytes)
                .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
                await terminal.print(`HEX     : ${hex}`, { type: 'success' });
                break;
            }
            case 'rot13': {
                await terminal.print(`ROT13   : ${rot13(payload)}`, { type: 'success' });
                break;
            }
            case 'binary': {
                const bin = Array.from(bytes)
                .map((b) => b.toString(2).padStart(8, '0'))
                .join(' ');
                await terminal.print(`BINARY  : ${bin}`, { type: 'success' });
                break;
            }
            default:
                terminal.audio.playError();
                await terminal.print(
                    `Unknown cipher "${mode}". Supported: sha256, base64, hex, rot13, binary`,
                    { type: 'error' }
                );
        }
    }
},

{
    name: 'hex',
    aliases: ['hexdump'],
    category: 'utility',
    description: 'Generate a formatted 16-byte hexadecimal + ASCII memory dump of a file or string.',
    usage: 'hex <filename | text>',
    examples: ['hex security.key', 'hex "Ghost Shell CRT"'],
    execute: async ({ args, terminal }) => {
        if (args.length === 0) {
            terminal.audio.playError();
            await terminal.print('Usage: hex <filename | text>', { type: 'error' });
            return;
        }

        const target = args.join(' ');
        const file = terminal.state.fs[args[0]];
        const source = file ? file.content : target;

        await terminal.print(
            `OFFSET    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  |ASCII           |`,
            { type: 'system' }
        );
        await terminal.print(formatHexDump(source), { type: 'ascii' });
    }
},

{
    name: 'scan',
    aliases: ['ping', 'trace'],
    category: 'utility',
    description: 'Run an animated cyberpunk subnet telemetry and port diagnostic sweep.',
    usage: 'scan [target_host]',
    examples: ['scan', 'scan 10.244.8.1'],
    execute: async ({ args, terminal }) => {
        const target = args[0] ?? 'RABAT-NEXUS-CORE.INTERNAL';
        await terminal.print(`INITIATING QUANTUM SUBNET SWEEP -> [${target}]`, {
            type: 'system',
            typewriter: true,
            speed: 8
        });
        if (terminal.isAborted) return;

        const hops = [
            { node: '10.244.0.1   (LOCAL-CRT-BRIDGE)', port: '443/TLS', latency: '0.4ms', status: 'OPEN // ENCRYPTED' },
            { node: '10.244.8.14  (ATLAS-BACKBONE-01)', port: '8443/SSH', latency: '2.1ms', status: 'OPEN // KEY-VERIFIED' },
            { node: '172.31.90.4  (ORBITAL-RELAY-7)', port: '9001/GHOST', latency: '6.8ms', status: 'OPEN // MULTIPLEX' },
            { node: `192.0.2.254  (${target})`, port: '31337/ROOT', latency: '9.3ms', status: 'SOVEREIGN ACCESS' }
        ];

        for (const hop of hops) {
            if (terminal.isAborted) return;
            terminal.audio.playBeep(720 + Math.random() * 400, 45);
            await terminal.print(
                `  [██████████] ${hop.node.padEnd(32)} PORT: ${hop.port.padEnd(11)} RTT: ${hop.latency.padEnd(6)} [${hop.status}]`,
                { type: 'success', typewriter: true, speed: 4, playSound: false }
            );
            if (terminal.isAborted) return;
        }

        if (terminal.isAborted) return;
        terminal.audio.playSuccess();
        await terminal.print('Sweep complete: 4/4 nodes responsive, 0% packet loss.', {
            type: 'system'
        });
    }
},

{
    name: 'weather',
    aliases: ['atmos'],
    category: 'utility',
    description: 'Display sector atmospheric telemetry report.',
    usage: 'weather [sector]',
    execute: async ({ args, terminal }) => {
        const sector = (args.join(' ') || 'RABAT // SECTOR-01').toUpperCase();
        terminal.printTable(
            ['PARAMETER', 'TELEMETRY READOUT', 'STATUS'],
            [
                ['SECTOR', sector, 'LOCKED'],
                ['AMBIENT TEMP', '21.4 °C (294.55 K)', 'NOMINAL'],
                            ['IONIZATION', '0.04 mSv/hr (LOW SOLAR FLUX)', 'SAFE'],
                            ['PRECIPITATION', '0% // CLEAR NIGHT SKYLINE', 'OPTIMAL'],
                            ['EM INTERFERENCE', '-94 dBm (CLEAN CARRIER)', 'STABLE']
            ]
        );
    }
}
];
