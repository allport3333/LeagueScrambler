// Run the same TypeScript generator that the Tournament Center uses.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../../Allport\'s League Scrambler/ClientApp');
const ts = require(path.join(root, 'node_modules/typescript'));
function loadSource(relative, dependencies = {}) {
    const filename = path.join(root, 'src/app', relative + '.ts');
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    });
    const mod = new Module(filename, module);
    mod.require = name => {
        if (name in dependencies) return dependencies[name];
        throw new Error('Unexpected dependency ' + name);
    };
    mod._compile(compiled.outputText, filename);
    return mod.exports;
}
const engine = loadSource('scrambler/scramble-engine');
const generator = loadSource('tournament-generation', { './scrambler/scramble-engine': engine });
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
generator.generateTournament(input.settings, input.players, input.pending, input.preserved, input.prohibitedPairs || [],
    Boolean(input.allowFallback), require('node:crypto').randomInt)
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
