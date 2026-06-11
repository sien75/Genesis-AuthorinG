import type {
  GagcodeGraphIndex,
  GagcodeGraphNode,
  GagcodeIndexedFact,
  GagcodeModel,
  GagcodeStructuredIndex,
  GagcodeVectorDocument,
  GagcodeVectorIndex
} from "./gagcode-types.js";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "const",
  "function",
  "return",
  "import",
  "export",
  "async",
  "await",
  "true",
  "false",
  "undefined",
  "null"
]);

export function buildGagcodeIndexes(model: GagcodeModel): {
  structured: GagcodeStructuredIndex;
  graph: GagcodeGraphIndex;
  vector: GagcodeVectorIndex;
} {
  const generatedAt = new Date().toISOString();
  const indexedFacts = flattenFacts(model);
  return {
    structured: buildStructuredIndex(indexedFacts, generatedAt),
    graph: buildGraphIndex(model, indexedFacts, generatedAt),
    vector: buildVectorIndex(indexedFacts, generatedAt)
  };
}

export function queryStructuredIndex(index: GagcodeStructuredIndex, query: string, limit: number): GagcodeIndexedFact[] {
  const terms = tokenize(query);
  const candidateIds = new Set<string>();

  for (const term of terms) {
    addMatchingKeys(index.bySymbol, term, candidateIds);
    addMatchingKeys(index.byField, term, candidateIds);
    addMatchingKeys(index.byType, term, candidateIds);
    addMatchingKeys(index.byFile, term, candidateIds);
    addMatchingKeys(index.byEntryKind, term, candidateIds);
  }

  const candidates = [...candidateIds].map((id) => index.byFactId[id]).filter(Boolean);
  return rankText(candidates, query).slice(0, limit);
}

export function queryVectorIndex(index: GagcodeVectorIndex, query: string, limit: number): GagcodeVectorDocument[] {
  const queryWeights = weightsFor(tokenize(query), index.vocabulary);
  return index.documents
    .map((document) => ({ document, score: cosine(queryWeights, document.weights) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.document);
}

export function queryGraphIndex(index: GagcodeGraphIndex, query: string, depth: number, limit: number): {
  nodes: GagcodeGraphNode[];
  edges: typeof index.edges;
} {
  const terms = tokenize(query);
  const seedIds = Object.values(index.nodes)
    .filter((node) => terms.some((term) => node.label.toLowerCase().includes(term)))
    .slice(0, limit)
    .map((node) => node.id);

  const visited = new Set(seedIds);
  let frontier = seedIds;

  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    for (const edge of index.edges) {
      if (frontier.includes(edge.from) && !visited.has(edge.to)) {
        visited.add(edge.to);
        next.push(edge.to);
      }
      if (frontier.includes(edge.to) && !visited.has(edge.from)) {
        visited.add(edge.from);
        next.push(edge.from);
      }
    }
    frontier = next;
  }

  const edges = index.edges.filter((edge) => visited.has(edge.from) && visited.has(edge.to));
  return {
    nodes: [...visited].map((id) => index.nodes[id]).filter(Boolean).slice(0, limit),
    edges: edges.slice(0, limit)
  };
}

function buildStructuredIndex(facts: GagcodeIndexedFact[], generatedAt: string): GagcodeStructuredIndex {
  const index: GagcodeStructuredIndex = {
    schema: "gagcode.structured-index.v1",
    generatedAt,
    byFile: objectMap(),
    bySymbol: objectMap(),
    byField: objectMap(),
    byType: objectMap(),
    byEntryKind: objectMap(),
    byFactId: objectMap()
  };

  for (const fact of facts) {
    index.byFactId[fact.id] = fact;
    add(index.byFile, fact.file, fact.id);
    if (["symbol", "definition", "reference", "call"].includes(fact.kind)) add(index.bySymbol, fact.label, fact.id);
    if (fact.kind === "fieldRead" || fact.kind === "fieldWrite") add(index.byField, fact.label, fact.id);
    if (fact.kind === "type") add(index.byType, fact.label, fact.id);
    if (fact.kind === "entry") add(index.byEntryKind, fact.label, fact.id);
  }

  return index;
}

function buildGraphIndex(model: GagcodeModel, facts: GagcodeIndexedFact[], generatedAt: string): GagcodeGraphIndex {
  const nodes: Record<string, GagcodeGraphNode> = objectMap();
  const edges: GagcodeGraphIndex["edges"] = [];

  for (const file of model.facts.files) {
    nodes[`file:${file.path}`] = { id: `file:${file.path}`, kind: "file", label: file.path, file: file.path };
  }

  for (const fact of facts) {
    nodes[fact.id] = { id: fact.id, kind: factKindToNodeKind(fact.kind), label: fact.label, file: fact.file, line: fact.line };
    edges.push({ from: `file:${fact.file}`, to: fact.id, kind: "contains", evidence: `${fact.file}:${fact.line}` });
  }

  for (const call of model.facts.calls) {
    if (call.resolvedTo) {
      edges.push({ from: call.id, to: `definition:${call.resolvedTo}`, kind: "calls", evidence: call.evidence });
      nodes[`definition:${call.resolvedTo}`] ??= {
        id: `definition:${call.resolvedTo}`,
        kind: "symbol",
        label: call.resolvedTo
      };
    }
  }

  for (const reference of model.facts.references) {
    if (reference.definition) {
      edges.push({ from: reference.id, to: `definition:${reference.definition}`, kind: "references", evidence: reference.evidence });
      nodes[`definition:${reference.definition}`] ??= {
        id: `definition:${reference.definition}`,
        kind: "symbol",
        label: reference.definition
      };
    }
  }

  for (const read of model.facts.fieldReads) {
    const fieldNode = `field:${read.ownerType ?? read.object ?? "unknown"}.${read.field}`;
    nodes[fieldNode] ??= { id: fieldNode, kind: "field", label: fieldNode.replace(/^field:/, "") };
    edges.push({ from: read.id, to: fieldNode, kind: "reads", evidence: read.evidence });
  }

  for (const write of model.facts.fieldWrites) {
    const fieldNode = `field:${write.ownerType ?? write.object ?? "unknown"}.${write.field}`;
    nodes[fieldNode] ??= { id: fieldNode, kind: "field", label: fieldNode.replace(/^field:/, "") };
    edges.push({ from: write.id, to: fieldNode, kind: "writes", evidence: write.evidence });
  }

  for (const importFact of model.facts.imports) {
    const importNode = `import:${importFact.from}`;
    nodes[importNode] ??= { id: importNode, kind: "fact", label: importFact.from };
    edges.push({ from: importFact.id, to: importNode, kind: "imports", evidence: importFact.evidence });
  }

  return { schema: "gagcode.graph-index.v1", generatedAt, nodes, edges };
}

function buildVectorIndex(facts: GagcodeIndexedFact[], generatedAt: string): GagcodeVectorIndex {
  const documents: GagcodeVectorDocument[] = facts.map((fact) => ({
    id: fact.id,
    kind: fact.kind,
    file: fact.file,
    line: fact.line,
    label: fact.label,
    text: fact.text,
    weights: objectMap()
  }));

  const documentTerms = documents.map((document) => tokenize(`${document.kind} ${document.label} ${document.text} ${document.file}`));
  const documentFrequency = new Map<string, number>();
  for (const terms of documentTerms) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const vocabulary: Record<string, number> = objectMap();
  for (const term of [...documentFrequency.keys()].sort()) {
    vocabulary[term] = Object.keys(vocabulary).length;
  }

  documents.forEach((document, index) => {
    document.weights = weightsFor(documentTerms[index] ?? [], vocabulary, documentFrequency, documents.length);
  });

  return {
    schema: "gagcode.vector-index.v1",
    generatedAt,
    algorithm: "local-tfidf-lite",
    documents,
    vocabulary
  };
}

function flattenFacts(model: GagcodeModel): GagcodeIndexedFact[] {
  return [
    ...model.facts.entries.map((fact) => indexed(fact.id, "entry", fact.file, fact.line, fact.kind, fact.evidence, fact.source)),
    ...model.facts.symbols.map((fact) => indexed(fact.id, "symbol", fact.file, fact.line, fact.name, fact.evidence, fact.source)),
    ...model.facts.imports.map((fact) => indexed(fact.id, "import", fact.file, fact.line, fact.from, fact.evidence, fact.source)),
    ...model.facts.calls.map((fact) => indexed(fact.id, "call", fact.file, fact.line, fact.callee, fact.evidence, fact.source)),
    ...model.facts.fieldReads.map((fact) => indexed(fact.id, "fieldRead", fact.file, fact.line, fact.field, fact.evidence, fact.source)),
    ...model.facts.fieldWrites.map((fact) => indexed(fact.id, "fieldWrite", fact.file, fact.line, fact.field, fact.evidence, fact.source)),
    ...model.facts.definitions.map((fact) => indexed(fact.id, "definition", fact.file, fact.line, fact.name, fact.evidence, fact.source)),
    ...model.facts.references.map((fact) => indexed(fact.id, "reference", fact.file, fact.line, fact.name, fact.evidence, fact.source)),
    ...model.facts.types.map((fact) => indexed(fact.id, "type", fact.file, fact.line, fact.name, fact.text, fact.source))
  ];
}

function indexed(id: string, kind: string, file: string, line: number, label: string, text: string, source?: string): GagcodeIndexedFact {
  return { id, kind, file, line, label, text, source };
}

function add(index: Record<string, string[]>, key: string, id: string): void {
  const normalized = key.toLowerCase();
  index[normalized] ??= [];
  index[normalized].push(id);
}

function addMatchingKeys(index: Record<string, string[]>, term: string, output: Set<string>): void {
  for (const [key, ids] of Object.entries(index)) {
    if (key.includes(term)) {
      for (const id of ids) output.add(id);
    }
  }
}

function rankText<T extends { label: string; text: string; file: string }>(items: T[], query: string): T[] {
  const terms = tokenize(query);
  return items
    .map((item) => ({
      item,
      score: terms.reduce((sum, term) => sum + scoreText(item.label, term) * 3 + scoreText(item.file, term) + scoreText(item.text, term), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map((ranked) => ranked.item);
}

function scoreText(value: string, term: string): number {
  return value.toLowerCase().includes(term) ? 1 : 0;
}

function tokenize(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

function weightsFor(
  terms: string[],
  vocabulary: Record<string, number>,
  documentFrequency?: Map<string, number>,
  documentCount?: number
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms) {
    if (term in vocabulary) counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  const weights: Record<string, number> = objectMap();
  for (const [term, count] of counts) {
    const idf = documentFrequency && documentCount ? Math.log(1 + documentCount / (1 + (documentFrequency.get(term) ?? 0))) : 1;
    weights[String(vocabulary[term])] = count * idf;
  }
  return weights;
}

function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const value of Object.values(a)) aNorm += value * value;
  for (const value of Object.values(b)) bNorm += value * value;
  for (const [key, value] of Object.entries(a)) dot += value * (b[key] ?? 0);
  return aNorm && bNorm ? dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm)) : 0;
}

function factKindToNodeKind(kind: string): GagcodeGraphNode["kind"] {
  if (kind === "entry") return "entry";
  if (kind === "symbol" || kind === "definition" || kind === "reference" || kind === "call") return "symbol";
  if (kind === "type") return "type";
  if (kind === "fieldRead" || kind === "fieldWrite") return "field";
  return "fact";
}

function objectMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}
