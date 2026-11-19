// Dumps src/i18n/en.ts to JSON for the translation script.
// Usage: node scripts/dump-i18n.js > /tmp/en.json
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const src = fs.readFileSync(path.join(__dirname, "..", "src", "i18n", "en.ts"), "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", out)(mod, mod.exports, require);
process.stdout.write(JSON.stringify({ strings: mod.exports.en, legal: mod.exports.legalContent }, null, 2));
