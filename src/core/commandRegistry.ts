import {
    CommandCategory,
    CommandDefinition,
    CommandRegistryController,
    ParsedCommandInput
} from '../types';

export class CommandRegistry implements CommandRegistryController {
    private commands = new Map<string, CommandDefinition>();
    private aliasMap = new Map<string, string>();

    public register(definition: CommandDefinition): void {
        const normalizedName = definition.name.toLowerCase();
        this.commands.set(normalizedName, definition);

        if (definition.aliases) {
            for (const alias of definition.aliases) {
                this.aliasMap.set(alias.toLowerCase(), normalizedName);
            }
        }
    }

    public registerMany(definitions: CommandDefinition[]): void {
        for (const def of definitions) {
            this.register(def);
        }
    }

    public get(name: string): CommandDefinition | undefined {
        const key = name.toLowerCase();
        const resolved = this.aliasMap.get(key) ?? key;
        return this.commands.get(resolved);
    }

    public getAll(): CommandDefinition[] {
        return Array.from(this.commands.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    public getByCategory(category: CommandCategory): CommandDefinition[] {
        return this.getAll().filter((cmd) => cmd.category === category);
    }

    public parse(rawInput: string): ParsedCommandInput {
        const trimmed = rawInput.trim();
        const tokens = this.tokenize(trimmed);
        const commandName = (tokens.shift() ?? '').toLowerCase();

        const args: string[] = [];
        const flags: Record<string, string | boolean> = {};

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.startsWith('--') && token.length > 2) {
                const eqIdx = token.indexOf('=');
                if (eqIdx !== -1) {
                    const key = token.slice(2, eqIdx);
                    const val = token.slice(eqIdx + 1);
                    flags[key] = val;
                } else {
                    const key = token.slice(2);
                    const next = tokens[i + 1];
                    if (next && !next.startsWith('-')) {
                        flags[key] = next;
                        i++;
                    } else {
                        flags[key] = true;
                    }
                }
            } else if (token.startsWith('-') && token.length > 1 && !/^-\d/.test(token)) {
                const shortFlags = token.slice(1).split('');
                for (const sf of shortFlags) {
                    flags[sf] = true;
                }
            } else {
                args.push(token);
            }
        }

        return {
            commandName,
            args,
            flags,
            rawInput: trimmed
        };
    }

    private tokenize(input: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let quoteChar: '"' | "'" | null = null;
        let escaped = false;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];

            if (escaped) {
                current += ch;
                escaped = false;
                continue;
            }

            if (ch === '\\') {
                escaped = true;
                continue;
            }

            if (quoteChar) {
                if (ch === quoteChar) {
                    quoteChar = null;
                } else {
                    current += ch;
                }
            } else if (ch === '"' || ch === "'") {
                quoteChar = ch;
            } else if (/\s/.test(ch)) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += ch;
            }
        }

        if (current.length > 0) {
            tokens.push(current);
        }

        return tokens;
    }

    public autocomplete(partialInput: string, fileNames: string[]): string[] {
        const trimmedLeft = partialInput.trimStart();
        if (!trimmedLeft) {
            return this.getAll().map((c) => c.name);
        }

        const parts = trimmedLeft.split(/\s+/);

        // Completing command name
        if (parts.length === 1 && !partialInput.endsWith(' ')) {
            const prefix = parts[0].toLowerCase();
            const candidates = new Set<string>();

            for (const cmd of this.commands.keys()) {
                if (cmd.startsWith(prefix)) candidates.add(cmd);
            }
            for (const alias of this.aliasMap.keys()) {
                if (alias.startsWith(prefix)) candidates.add(alias);
            }
            return Array.from(candidates).sort();
        }

        // Completing arguments (subcommands, themes, or virtual files)
        const cmdName = parts[0].toLowerCase();
        const resolved = this.aliasMap.get(cmdName) ?? cmdName;
        const argPrefix = partialInput.endsWith(' ') ? '' : (parts[parts.length - 1] ?? '').toLowerCase();

        let pool: string[] = [];
        if (resolved === 'theme') {
            pool = ['green', 'amber', 'cyan', 'magenta', 'white'];
        } else if (resolved === 'help' || resolved === 'man') {
            pool = Array.from(this.commands.keys());
        } else if (resolved === 'cat' || resolved === 'rm' || resolved === 'hex' || resolved === 'write') {
            pool = fileNames;
        } else if (resolved === 'audio') {
            pool = ['on', 'off', 'vol', 'test'];
        } else if (resolved === 'crt') {
            pool = ['on', 'off', 'toggle'];
        } else if (resolved === 'hash') {
            pool = ['sha256', 'base64', 'hex', 'rot13', 'binary'];
        } else {
            pool = fileNames;
        }

        return pool
        .filter((item) => item.toLowerCase().startsWith(argPrefix))
        .map((match) => {
            const base = partialInput.endsWith(' ')
            ? partialInput
            : partialInput.slice(0, partialInput.length - argPrefix.length);
            return `${base}${match}`;
        });
    }

    public findSimilar(inputName: string): string | null {
        const target = inputName.toLowerCase();
        let bestMatch: string | null = null;
        let bestDistance = Infinity;

        const allKeys = [...this.commands.keys(), ...this.aliasMap.keys()];
        for (const candidate of allKeys) {
            const dist = this.levenshtein(target, candidate);
            if (dist < bestDistance && dist <= 2) {
                bestDistance = dist;
                bestMatch = candidate;
            }
        }

        return bestMatch;
    }

    private levenshtein(a: string, b: string): number {
        const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
        );

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    }
}
