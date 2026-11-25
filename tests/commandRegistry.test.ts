import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../src/core/commandRegistry';
import { systemCommands } from '../src/commands/system';
import { utilityCommands } from '../src/commands/utility';
import { visualCommands } from '../src/commands/visual';

function createPopulatedRegistry(): CommandRegistry {
    const registry = new CommandRegistry();
    registry.registerMany(systemCommands);
    registry.registerMany(visualCommands);
    registry.registerMany(utilityCommands);
    return registry;
}

describe('CommandRegistry parser & lookup', () => {
    it('does not misread unrecognized short-like arguments such as "echo -foo" as short flags', () => {
        const populated = createPopulatedRegistry();
        const parsed = populated.parse('echo -foo');
        expect(parsed.commandName).toBe('echo');
        expect(parsed.args).toEqual(['-foo']);
        expect(parsed.flags).toEqual({});

        const aliasParsed = populated.parse('print -foo -bar');
        expect(aliasParsed.commandName).toBe('print');
        expect(aliasParsed.args).toEqual(['-foo', '-bar']);
        expect(aliasParsed.flags).toEqual({});

        const bare = new CommandRegistry();
        const bareParsed = bare.parse('echo -foo');
        expect(bareParsed.args).toEqual(['-foo']);
        expect(bareParsed.flags).toEqual({});
    });

    it('keeps mixed known/unknown short flag tokens like "echo -tf" as positional arguments', () => {
        const registry = createPopulatedRegistry();
        const parsed = registry.parse('echo -tf hello');
        expect(parsed.args).toEqual(['-tf', 'hello']);
        expect(parsed.flags).toEqual({});
    });

    it('parses recognized boolean short and long flags without consuming positional arguments', () => {
        const registry = createPopulatedRegistry();

        const shortEcho = registry.parse('echo -t "Hello CRT"');
        expect(shortEcho.flags).toEqual({ t: true });
        expect(shortEcho.args).toEqual(['Hello CRT']);

        const longEcho = registry.parse('echo --typewriter "Wake up, Operator..."');
        expect(longEcho.flags).toEqual({ typewriter: true });
        expect(longEcho.args).toEqual(['Wake up, Operator...']);

        const unknownLong = registry.parse('echo --unknown hello');
        expect(unknownLong.flags).toEqual({});
        expect(unknownLong.args).toEqual(['--unknown', 'hello']);

        const histLong = registry.parse('history --clear');
        expect(histLong.flags).toEqual({ clear: true });
        expect(histLong.args).toEqual([]);

        const histShort = registry.parse('history -c');
        expect(histShort.flags).toEqual({ c: true });
        expect(histShort.args).toEqual([]);
    });

    it('preserves negative numbers and quoted strings with escaped characters', () => {
        const registry = createPopulatedRegistry();

        const calcNeg = registry.parse('calc -5 + 3');
        expect(calcNeg.args).toEqual(['-5', '+', '3']);
        expect(calcNeg.flags).toEqual({});

        const quoted = registry.parse('echo "hello \\"ghost\\" shell" \'raw -foo\'');
        expect(quoted.args).toEqual(['hello "ghost" shell', 'raw -foo']);
        expect(quoted.flags).toEqual({});
    });

    it('supports value-taking flags and stacked recognized short flags on custom commands', () => {
        const registry = new CommandRegistry();
        registry.register({
            name: 'deploy',
            category: 'system',
            description: 'Custom test command',
            usage: 'deploy [-tc] [--target=<node>]',
            supportedFlags: [
                { short: 't', long: 'test' },
                { short: 'c', long: 'check' },
                { short: 'o', long: 'output', takesValue: true }
            ],
            execute: () => {}
        });

        const stacked = registry.parse('deploy -tc --output dist/bundle.js -x');
        expect(stacked.flags).toEqual({ t: true, c: true, output: 'dist/bundle.js' });
        expect(stacked.args).toEqual(['-x']);

        const eqForm = registry.parse('deploy --output=out.log -o custom.txt');
        expect(eqForm.flags).toEqual({ output: 'out.log', o: 'custom.txt' });
        expect(eqForm.args).toEqual([]);
    });

    it('resolves aliases, autocompletion, and Levenshtein suggestions', () => {
        const registry = createPopulatedRegistry();

        expect(registry.get('cls')?.name).toBe('clear');
        expect(registry.get('neofetch')?.name).toBe('sysinfo');

        expect(registry.autocomplete('theme a', [])).toEqual(['theme amber']);
        expect(registry.autocomplete('cat man', ['manifesto.txt', 'notes.txt'])).toEqual([
            'cat manifesto.txt'
        ]);

        expect(registry.findSimilar('sysnfo')).toBe('sysinfo');
        expect(registry.findSimilar('zzzzzzzzzz')).toBeNull();
    });
});
