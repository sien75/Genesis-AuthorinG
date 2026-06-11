#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { ensureJsonFile, readJson, writeJson } from "./gagcode-files.js";
import { gagcodePaths } from "./gagcode-paths.js";
import { collectGagcodeFacts } from "./gagcode-scan.js";
import type {
  GagcodeConfig,
  GagcodeGraphIndex,
  GagcodeModel,
  GagcodeStructuredIndex,
  GagcodeSummary,
  GagcodeVectorDocument,
  GagcodeVectorIndex
} from "./gagcode-types.js";
import { buildGagcodeIndexes, queryGraphIndex, queryStructuredIndex, queryVectorIndex } from "./gagcode-index.js";

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);
const root = process.cwd();
const DEFAULT_QUERY_LIMIT = 10;

try {
  switch (command) {
    case "init":
      await initGagcode(root);
      break;
    case "scan":
      await scanGagcode(root);
      break;
    case "validate":
      await validateGagcode(root);
      break;
case "query":
      await queryGagcode(root, readQueryArgs(args), readLimit(args));
      break;
    case "uninstall":
      await uninstallGagcode();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function initGagcode(projectRoot: string): Promise<void> {
  const paths = gagcodePaths(projectRoot);
  const config: GagcodeConfig = {
    schema: "gagcode.config.v1",
    projectName: path.basename(projectRoot),
    root: projectRoot,
    createdAt: new Date().toISOString(),
    include: ["**/*"],
    exclude: ["node_modules", ".git", ".gagcode", "dist", "build", "coverage"]
  };

  await fs.mkdir(paths.facts, { recursive: true });
  await fs.mkdir(paths.index, { recursive: true });
  await fs.mkdir(paths.semantic, { recursive: true });
  await ensureJsonFile(paths.config, config);
  await ensureJsonFile(paths.capabilities, []);
  await ensureJsonFile(paths.flows, []);
  await ensureJsonFile(paths.states, []);
  await ensureJsonFile(paths.constraints, []);
  await ensureJsonFile(paths.impacts, []);

  console.log(`Initialized ${path.relative(projectRoot, paths.base)}`);
}

async function scanGagcode(projectRoot: string): Promise<void> {
  await initGagcode(projectRoot);
  const paths = gagcodePaths(projectRoot);
  const facts = await collectGagcodeFacts(projectRoot);
  const languageCounts = facts.files.reduce<Record<string, number>>((counts, file) => {
    counts[file.language] = (counts[file.language] ?? 0) + 1;
    return counts;
  }, {});

  const summary: GagcodeSummary = {
    schema: "gagcode.summary.v1",
    generatedAt: new Date().toISOString(),
    root: projectRoot,
    fileCount: facts.files.length,
    languageCounts,
    entryCount: facts.entries.length,
    symbolCount: facts.symbols.length,
    importCount: facts.imports.length,
    callCount: facts.calls.length,
    fieldReadCount: facts.fieldReads.length,
    fieldWriteCount: facts.fieldWrites.length,
    definitionCount: facts.definitions.length,
    referenceCount: facts.references.length,
    typeCount: facts.types.length,
    adapterCounts: adapterCounts(facts),
    nextSteps: [
      "Ask the gagcode skill to infer capabilities, flows, states, constraints, and impacts from .gagcode/facts.",
      "Run gagcode validate after semantic artifacts are written.",
      "Run gagcode query to search the indexed facts."
    ]
  };

  const model = await buildModel(projectRoot, summary, facts);
  const indexes = buildGagcodeIndexes(model);

  await writeJson(paths.files, facts.files);
  await writeJson(paths.entries, facts.entries);
  await writeJson(paths.symbols, facts.symbols);
  await writeJson(paths.imports, facts.imports);
  await writeJson(paths.calls, facts.calls);
  await writeJson(paths.fieldReads, facts.fieldReads);
  await writeJson(paths.fieldWrites, facts.fieldWrites);
  await writeJson(paths.definitions, facts.definitions);
  await writeJson(paths.references, facts.references);
  await writeJson(paths.types, facts.types);
  await writeJson(paths.structuredIndex, indexes.structured);
  await writeJson(paths.graphIndex, indexes.graph);
  await writeJson(paths.vectorIndex, indexes.vector);
  await writeJson(paths.summary, summary);
  await writeJson(paths.model, model);

  console.log(
    `Scanned ${facts.files.length} files, ${facts.entries.length} entries, ${facts.symbols.length} symbols, ${facts.calls.length} calls`
  );
}

async function validateGagcode(projectRoot: string): Promise<void> {
  const paths = gagcodePaths(projectRoot);
  const requiredFiles = [
    paths.config,
    paths.summary,
    paths.model,
    paths.files,
    paths.entries,
    paths.symbols,
    paths.imports,
    paths.calls,
    paths.fieldReads,
    paths.fieldWrites,
    paths.definitions,
    paths.references,
    paths.types,
    paths.structuredIndex,
    paths.graphIndex,
    paths.vectorIndex,
    paths.capabilities,
    paths.flows,
    paths.states,
    paths.constraints,
    paths.impacts
  ];

  for (const file of requiredFiles) {
    await readJson<unknown>(file);
  }

  const model = await readJson<GagcodeModel>(paths.model);
  if (model.schema !== "gagcode.model.v1") {
    throw new Error("Invalid gagcode model schema");
  }

  console.log("gagcode artifacts are valid");
}

async function queryGagcode(projectRoot: string, query: string, limit: number): Promise<void> {
  if (!query) {
    throw new Error("Usage: gagcode query <text> [--limit 10]");
  }

  const paths = gagcodePaths(projectRoot);
  const structured = await readJson<GagcodeStructuredIndex>(paths.structuredIndex);
  const graph = await readJson<GagcodeGraphIndex>(paths.graphIndex);
  const vector = await readJson<GagcodeVectorIndex>(paths.vectorIndex);
  const result = {
    query,
    limit,
    structured: queryStructuredIndex(structured, query, limit),
    vector: compactVectorDocuments(queryVectorIndex(vector, query, limit)),
    graph: queryGraphIndex(graph, query, 2, limit)
  };
  console.log(JSON.stringify(result, null, 2));
}

async function uninstallGagcode(): Promise<void> {
  const home = process.env.HOME;
  if (!home) {
    throw new Error("Cannot uninstall gagcode: HOME is not set");
  }

  const installDir = path.resolve(process.env.GAGCODE_INSTALL_DIR ?? path.join(home, ".gagcode", "cli"));
  const binPath = path.resolve(process.env.GAGCODE_BIN_DIR ?? path.join(home, ".local", "bin"), "gagcode");

  let removedBin = false;
  try {
    const binStat = await fs.lstat(binPath);
    if (!binStat.isSymbolicLink()) {
      throw new Error(`Refusing to remove non-symlink executable: ${binPath}`);
    }

    const target = await fs.readlink(binPath);
    const resolvedTarget = path.resolve(path.dirname(binPath), target);
    if (!isPathInside(resolvedTarget, installDir)) {
      throw new Error(`Refusing to remove symlink that does not point into ${installDir}: ${binPath}`);
    }

    await fs.unlink(binPath);
    removedBin = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.rm(installDir, { recursive: true, force: true });

  console.log(`Removed gagcode executable: ${removedBin ? binPath : "not found"}`);
  console.log(`Removed gagcode install directory: ${installDir}`);
}

function isPathInside(value: string, parent: string): boolean {
  const relative = path.relative(parent, value);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function adapterCounts(facts: GagcodeModel["facts"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const collection of [
    facts.entries,
    facts.symbols,
    facts.imports,
    facts.calls,
    facts.fieldReads,
    facts.fieldWrites,
    facts.definitions,
    facts.references,
    facts.types
  ]) {
    for (const fact of collection) {
      counts[fact.source] = (counts[fact.source] ?? 0) + 1;
    }
  }
  return counts;
}

async function buildModel(
  projectRoot: string,
  summary: GagcodeSummary,
  facts: GagcodeModel["facts"]
): Promise<GagcodeModel> {
  const paths = gagcodePaths(projectRoot);
  return {
    schema: "gagcode.model.v1",
    generatedAt: new Date().toISOString(),
    summary,
    facts,
    semantic: {
      capabilities: await readSemanticArray(paths.capabilities),
      flows: await readSemanticArray(paths.flows),
      states: await readSemanticArray(paths.states),
      constraints: await readSemanticArray(paths.constraints),
      impacts: await readSemanticArray(paths.impacts)
    }
  };
}

async function readSemanticArray(filePath: string): Promise<unknown[]> {
  try {
    const value = await readJson<unknown>(filePath);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readFlag(values: string[], name: string): string | undefined {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
}

function readLimit(values: string[]): number {
  const value = Number(readFlag(values, "--limit") ?? DEFAULT_QUERY_LIMIT);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_QUERY_LIMIT;
}

function compactVectorDocuments(documents: GagcodeVectorDocument[]): Array<Omit<GagcodeVectorDocument, "weights">> {
  return documents.map(({ weights: _weights, ...document }) => document);
}

function readQueryArgs(values: string[]): string {
  const output: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--limit") {
      index += 1;
      continue;
    }
    output.push(values[index] ?? "");
  }
  return output.join(" ").trim();
}

function printHelp(): void {
  console.log(`gagcode

Usage:
  gagcode init
  gagcode scan
  gagcode validate
  gagcode query <text> [--limit ${DEFAULT_QUERY_LIMIT}]
  gagcode uninstall
`);
}
