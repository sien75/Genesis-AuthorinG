import fs from "node:fs/promises";
import path from "node:path";
import { languageForFile, walkCodeFiles } from "./gagcode-files.js";
import { emptyFactBag, GagcodeIdFactory, type GagcodeFactBag, type GagcodeSemanticFactBag } from "./gagcode-adapters.js";
import { createTreeSitterSyntaxAdapter } from "./gagcode-tree-sitter-adapter.js";
import { createTypeScriptSemanticAdapter } from "./gagcode-typescript-adapter.js";
import type { GagcodeCallFact, GagcodeFieldAccessFact, GagcodeFileFact, GagcodeModel } from "./gagcode-types.js";

export async function collectGagcodeFacts(root: string): Promise<GagcodeModel["facts"]> {
  const relativeFiles = await walkCodeFiles(root);
  const files: GagcodeFileFact[] = [];
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
        } catch (error) {
          console.warn(`Skipped ${adapter.id} analysis for ${relative}: ${errorMessage(error)}`);
        }
      }
    }
  }

  for (const adapter of semanticAdapters) {
    if (adapter.supportsProject(root, relativeFiles)) {
      let semantic: GagcodeSemanticFactBag;
      try {
        semantic = adapter.analyzeProject({ root, relativeFiles });
      } catch (error) {
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
    calls: aggregateCalls(dedupeByEvidence(facts.calls)),
    fieldReads: aggregateFieldAccess(dedupeByEvidence(facts.fieldReads)),
    fieldWrites: aggregateFieldAccess(dedupeByEvidence(facts.fieldWrites)),
    definitions: dedupeByEvidence(facts.definitions),
    references: dedupeReferences(facts.references),
    types: dedupeByKey(facts.types, (fact) => `${fact.source}:${fact.file}:${fact.line}:${fact.name}:${fact.text}`)
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergeFacts(target: GagcodeFactBag, next: GagcodeFactBag): void {
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

function dedupeByEvidence<T extends { file: string; line: number; evidence: string; source: string }>(facts: T[]): T[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.source}:${fact.file}:${fact.line}:${fact.evidence}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeReferences<T extends { file: string; line: number; name: string; definition?: string }>(facts: T[]): T[] {
  return dedupeByKey(facts, (fact) => `${fact.file}:${fact.line}:${fact.name}:${fact.definition ?? ""}`);
}

function dedupeByKey<T>(facts: T[], keyFor: (fact: T) => string): T[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = keyFor(fact);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function aggregateCalls(facts: GagcodeCallFact[]): GagcodeCallFact[] {
  const map = new Map<string, GagcodeCallFact>();
  for (const fact of facts) {
    const key = `${fact.file}:${fact.callee}`;
    const existing = map.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
    } else {
      map.set(key, { ...fact, count: 1 });
    }
  }
  return Array.from(map.values());
}

function aggregateFieldAccess(facts: GagcodeFieldAccessFact[]): GagcodeFieldAccessFact[] {
  const map = new Map<string, GagcodeFieldAccessFact>();
  for (const fact of facts) {
    const key = `${fact.file}:${fact.object ?? ""}:${fact.field}`;
    const existing = map.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
    } else {
      map.set(key, { ...fact, count: 1 });
    }
  }
  return Array.from(map.values());
}
