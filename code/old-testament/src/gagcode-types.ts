export type GagcodeConfidence = "high" | "medium" | "low" | "unknown";

export interface GagcodeConfig {
  schema: "gagcode.config.v1";
  projectName: string;
  root: string;
  createdAt: string;
  include: string[];
  exclude: string[];
}

export interface GagcodeFileFact {
  path: string;
  extension: string;
  language: string;
  bytes: number;
  lines: number;
}

export type GagcodeFactSource =
  | "tree-sitter"
  | "typescript-compiler"
  | "regex-fallback"
  | "language-adapter";

export interface GagcodeEntryFact {
  id: string;
  kind: "http-route" | "ui-action" | "cli-command" | "test" | "script" | "unknown";
  name: string;
  file: string;
  line: number;
  evidence: string;
  confidence: GagcodeConfidence;
  source: GagcodeFactSource;
}

export interface GagcodeSymbolFact {
  id: string;
  kind: "function" | "class" | "type" | "interface" | "enum" | "constant" | "method" | "export";
  name: string;
  file: string;
  line: number;
  evidence: string;
  source: GagcodeFactSource;
}

export interface GagcodeImportFact {
  id: string;
  from: string;
  imported: string[];
  file: string;
  line: number;
  evidence: string;
  source: GagcodeFactSource;
}

export interface GagcodeCallFact {
  id: string;
  callee: string;
  resolvedTo?: string;
  file: string;
  line: number;
  evidence: string;
  source: GagcodeFactSource;
  count?: number;
}

export interface GagcodeFieldAccessFact {
  id: string;
  object?: string;
  field: string;
  ownerType?: string;
  file: string;
  line: number;
  evidence: string;
  source: GagcodeFactSource;
  count?: number;
}

export interface GagcodeDefinitionFact {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  type?: string;
  evidence: string;
  source: GagcodeFactSource;
}

export interface GagcodeReferenceFact {
  id: string;
  name: string;
  definition?: string;
  file: string;
  line: number;
  evidence: string;
  source: GagcodeFactSource;
}

export interface GagcodeTypeFact {
  id: string;
  name: string;
  kind: "type" | "interface" | "enum" | "class" | "inferred";
  file: string;
  line: number;
  values?: string[];
  text: string;
  source: GagcodeFactSource;
}

export interface GagcodeSummary {
  schema: "gagcode.summary.v1";
  generatedAt: string;
  root: string;
  fileCount: number;
  languageCounts: Record<string, number>;
  entryCount: number;
  symbolCount: number;
  importCount: number;
  callCount: number;
  fieldReadCount: number;
  fieldWriteCount: number;
  definitionCount: number;
  referenceCount: number;
  typeCount: number;
  adapterCounts: Record<string, number>;
  nextSteps: string[];
}

export interface GagcodeModel {
  schema: "gagcode.model.v1";
  generatedAt: string;
  summary: GagcodeSummary;
  facts: {
    files: GagcodeFileFact[];
    entries: GagcodeEntryFact[];
    symbols: GagcodeSymbolFact[];
    imports: GagcodeImportFact[];
    calls: GagcodeCallFact[];
    fieldReads: GagcodeFieldAccessFact[];
    fieldWrites: GagcodeFieldAccessFact[];
    definitions: GagcodeDefinitionFact[];
    references: GagcodeReferenceFact[];
    types: GagcodeTypeFact[];
  };
  semantic: {
    capabilities: unknown[];
    flows: unknown[];
    states: unknown[];
    constraints: unknown[];
    impacts: unknown[];
  };
}

export interface GagcodeStructuredIndex {
  schema: "gagcode.structured-index.v1";
  generatedAt: string;
  byFile: Record<string, string[]>;
  bySymbol: Record<string, string[]>;
  byField: Record<string, string[]>;
  byType: Record<string, string[]>;
  byEntryKind: Record<string, string[]>;
  byFactId: Record<string, GagcodeIndexedFact>;
}

export interface GagcodeIndexedFact {
  id: string;
  kind: string;
  file: string;
  line: number;
  label: string;
  text: string;
  source?: string;
}

export interface GagcodeGraphIndex {
  schema: "gagcode.graph-index.v1";
  generatedAt: string;
  nodes: Record<string, GagcodeGraphNode>;
  edges: GagcodeGraphEdge[];
}

export interface GagcodeGraphNode {
  id: string;
  kind: "file" | "entry" | "symbol" | "type" | "field" | "fact";
  label: string;
  file?: string;
  line?: number;
}

export interface GagcodeGraphEdge {
  from: string;
  to: string;
  kind: "contains" | "calls" | "defines" | "references" | "reads" | "writes" | "imports";
  evidence?: string;
}

export interface GagcodeVectorIndex {
  schema: "gagcode.vector-index.v1";
  generatedAt: string;
  algorithm: "local-tfidf-lite";
  documents: GagcodeVectorDocument[];
  vocabulary: Record<string, number>;
}

export interface GagcodeVectorDocument {
  id: string;
  kind: string;
  file: string;
  line: number;
  label: string;
  text: string;
  weights: Record<string, number>;
}
