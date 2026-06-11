import fs from "node:fs/promises";
import path from "node:path";
import { languageForFile, walkCodeFiles } from "./gagcode-files.js";
import { emptyFactBag, GagcodeIdFactory } from "./gagcode-adapters.js";
import { createTreeSitterSyntaxAdapter } from "./gagcode-tree-sitter-adapter.js";
import { createTypeScriptSemanticAdapter } from "./gagcode-typescript-adapter.js";
export async function collectGagcodeFacts(root) {
    const relativeFiles = await walkCodeFiles(root);
    const files = [];
    const idFactory = new GagcodeIdFactory();
    const facts = emptyFactBag();
    const syntaxAdapters = [createTreeSitterSyntaxAdapter(idFactory)];
    const semanticAdapters = [createTypeScriptSemanticAdapter(idFactory)];
    for (const relative of relativeFiles) {
        const absolute = path.join(root, relative);
        const raw = await fs.readFile(absolute, "utf8");
        const lines = raw.split(/\r?\n/);
        const stats = await fs.stat(absolute);
        files.push({
            path: relative,
            extension: path.extname(relative),
            language: languageForFile(relative),
            bytes: stats.size,
            lines: lines.length
        });
        for (const adapter of syntaxAdapters) {
            if (adapter.supports(relative)) {
                try {
                    mergeFacts(facts, adapter.analyzeFile({ root, relativePath: relative, text: raw }));
                }
                catch (error) {
                    console.warn(`Skipped ${adapter.id} analysis for ${relative}: ${errorMessage(error)}`);
                }
            }
        }
    }
    for (const adapter of semanticAdapters) {
        if (adapter.supportsProject(root, relativeFiles)) {
            let semantic;
            try {
                semantic = adapter.analyzeProject({ root, relativeFiles });
            }
            catch (error) {
                console.warn(`Skipped ${adapter.id} project analysis: ${errorMessage(error)}`);
                continue;
            }
            facts.calls.push(...semantic.calls);
            facts.fieldReads.push(...semantic.fieldReads);
            facts.fieldWrites.push(...semantic.fieldWrites);
            facts.definitions.push(...semantic.definitions);
            facts.references.push(...semantic.references);
            facts.types.push(...semantic.types);
        }
    }
    return {
        files,
        entries: dedupeByEvidence(facts.entries),
        symbols: dedupeByEvidence(facts.symbols),
        imports: dedupeByEvidence(facts.imports),
        calls: aggregateCalls(dedupeAcrossSources(facts.calls)),
        fieldReads: aggregateFieldAccess(dedupeFieldAccessAcrossSources(facts.fieldReads)),
        fieldWrites: aggregateFieldAccess(dedupeFieldAccessAcrossSources(facts.fieldWrites)),
        definitions: dedupeByEvidence(facts.definitions),
        references: dedupeReferences(facts.references),
        types: dedupeByKey(facts.types, (fact) => `${fact.source}:${fact.file}:${fact.line}:${fact.name}:${fact.text}`)
    };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function mergeFacts(target, next) {
    target.entries.push(...next.entries);
    target.symbols.push(...next.symbols);
    target.imports.push(...next.imports);
    target.calls.push(...next.calls);
    target.fieldReads.push(...next.fieldReads);
    target.fieldWrites.push(...next.fieldWrites);
    target.definitions.push(...next.definitions);
    target.references.push(...next.references);
    target.types.push(...next.types);
}
function dedupeByEvidence(facts) {
    const seen = new Set();
    return facts.filter((fact) => {
        const key = `${fact.source}:${fact.file}:${fact.line}:${fact.evidence}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function dedupeReferences(facts) {
    return dedupeByKey(facts, (fact) => `${fact.file}:${fact.line}:${fact.name}:${fact.definition ?? ""}`);
}
function dedupeByKey(facts, keyFor) {
    const seen = new Set();
    return facts.filter((fact) => {
        const key = keyFor(fact);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
const NOISE_FIELDS = new Set([
    "length", "size", "map", "filter", "reduce", "forEach", "find", "findIndex",
    "some", "every", "includes", "indexOf", "lastIndexOf", "flat", "flatMap",
    "slice", "splice", "concat", "join", "sort", "reverse", "fill",
    "push", "pop", "shift", "unshift", "keys", "values", "entries",
    "has", "get", "set", "delete", "clear", "add",
    "then", "catch", "finally",
    "toString", "valueOf", "toJSON", "toISOString", "toLocaleDateString",
    "trim", "trimStart", "trimEnd", "padStart", "padEnd",
    "startsWith", "endsWith", "replace", "replaceAll", "split", "match", "search",
    "toUpperCase", "toLowerCase", "charAt", "charCodeAt", "codePointAt", "at",
    "substring", "repeat",
    "call", "apply", "bind",
    "log", "warn", "error", "info", "debug", "trace",
    "resolve", "reject", "all", "allSettled", "race", "any",
    "parse", "stringify",
    "assign", "freeze", "defineProperty", "getOwnPropertyNames",
    "from", "of", "isArray",
    "abs", "ceil", "floor", "round", "max", "min", "pow", "sqrt", "random",
    "now", "UTC",
    "test", "exec",
    "next", "done", "value", "return",
    "prototype", "constructor", "__proto__"
]);
function isNoiseCall(callee) {
    const tail = callee.includes(".") ? callee.slice(callee.lastIndexOf(".") + 1) : callee;
    return NOISE_FIELDS.has(tail);
}
function aggregateCalls(facts) {
    const map = new Map();
    for (const fact of facts) {
        if (isNoiseCall(fact.callee))
            continue;
        const key = `${fact.file}:${fact.callee}`;
        const existing = map.get(key);
        if (existing) {
            existing.count = (existing.count ?? 1) + 1;
        }
        else {
            map.set(key, { ...fact, count: 1 });
        }
    }
    return Array.from(map.values());
}
function aggregateFieldAccess(facts) {
    const map = new Map();
    for (const fact of facts) {
        if (NOISE_FIELDS.has(fact.field))
            continue;
        const key = `${fact.file}:${fact.object ?? ""}:${fact.field}`;
        const existing = map.get(key);
        if (existing) {
            existing.count = (existing.count ?? 1) + 1;
        }
        else {
            map.set(key, { ...fact, count: 1 });
        }
    }
    return Array.from(map.values());
}
function dedupeAcrossSources(facts) {
    const map = new Map();
    for (const fact of facts) {
        const key = `${fact.file}:${fact.line}:${fact.callee}`;
        const existing = map.get(key);
        if (!existing || fact.source === "typescript-compiler") {
            map.set(key, fact);
        }
    }
    return Array.from(map.values());
}
function dedupeFieldAccessAcrossSources(facts) {
    const map = new Map();
    for (const fact of facts) {
        const key = `${fact.file}:${fact.line}:${fact.object ?? ""}:${fact.field}`;
        const existing = map.get(key);
        if (!existing || fact.source === "typescript-compiler") {
            map.set(key, fact);
        }
    }
    return Array.from(map.values());
}
