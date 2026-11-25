import {
    CommandCategory,
    CommandDefinition,
    CommandFlagDefinition,
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

        const definition = commandName ? this.get(commandName) : undefined;
        const flagDefs = definition?.supportedFlags;
        const shortFlagMap = new Map<string, CommandFlagDefinition>();
        const longFlagMap = new Map<string, CommandFlagDefinition>();

        if (flagDefs) {
            for (const spec of flagDefs) {
                if (spec.short) {
                    shortFlagMap.set(spec.short, spec);
                }
                if (spec.long) {
                    longFlagMap.set(spec.long, spec);
                }
            }
        }

        const assignFlag = (key: string, spec: CommandFlagDefinition | undefined, idx: number): number => {
            if (spec?.takesValue) {
                const next = tokens[idx + 1];
                if (next !== undefined && !next.startsWith('-')) {
                    flags[key] = next;
                    return idx + 1;
                }
            }
            flags[key] = true;
            return idx;
        };

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.startsWith('--') && token.length > 2) {
                const eqIdx = token.indexOf('=');
                const key = eqIdx !== -1 ? token.slice(2, eqIdx) : token.slice(2);

                if (flagDefs !== undefined) {
                    const spec = longFlagMap.get(key);
                    if (!spec) {
                        args.push(token);
                        continue;
                    }
                    if (eqIdx !== -1) {
                        flags[key] = token.slice(eqIdx + 1);
                    } else {
                        i = assignFlag(key, spec, i);
                    }
                } else if (eqIdx !== -1) {
                    flags[key] = token.slice(eqIdx + 1);
                } else {
                    flags[key] = true;
                }
            } else if (token.startsWith('-') && token.length > 1 && !/^-\d/.test(token)) {
                const shortChars = token.slice(1).split('');
                if (shortFlagMap.size > 0 && shortChars.every((ch) => shortFlagMap.has(ch))) {
                    if (shortChars.length === 1) {
                        const sf = shortChars[0];
                        i = assignFlag(sf, shortFlagMap.get(sf), i);
                    } else {
                        for (const sf of shortChars) {
                            flags[sf] = true;
                        }
                    }
                } else {
                    args.push(token);
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
