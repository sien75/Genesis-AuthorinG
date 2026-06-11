import type {
  GagcodeCallFact,
  GagcodeDefinitionFact,
  GagcodeEntryFact,
  GagcodeFieldAccessFact,
  GagcodeImportFact,
  GagcodeReferenceFact,
  GagcodeSymbolFact,
  GagcodeTypeFact
} from "./gagcode-types.js";

export interface GagcodeFactBag {
  entries: GagcodeEntryFact[];
  symbols: GagcodeSymbolFact[];
  imports: GagcodeImportFact[];
  calls: GagcodeCallFact[];
  fieldReads: GagcodeFieldAccessFact[];
  fieldWrites: GagcodeFieldAccessFact[];
  definitions: GagcodeDefinitionFact[];
  references: GagcodeReferenceFact[];
  types: GagcodeTypeFact[];
}

export interface GagcodeSemanticFactBag {
  calls: GagcodeCallFact[];
  fieldReads: GagcodeFieldAccessFact[];
  fieldWrites: GagcodeFieldAccessFact[];
  definitions: GagcodeDefinitionFact[];
  references: GagcodeReferenceFact[];
  types: GagcodeTypeFact[];
}

export interface GagcodeSyntaxAdapter {
  id: string;
  supports(relativePath: string): boolean;
  analyzeFile(input: {
    root: string;
    relativePath: string;
    text: string;
  }): GagcodeFactBag;
}

export interface GagcodeSemanticAdapter {
  id: string;
  supportsProject(root: string, relativeFiles: string[]): boolean;
  analyzeProject(input: {
    root: string;
    relativeFiles: string[];
  }): GagcodeSemanticFactBag;
}

export function emptyFactBag(): GagcodeFactBag {
  return {
    entries: [],
    symbols: [],
    imports: [],
    calls: [],
    fieldReads: [],
    fieldWrites: [],
    definitions: [],
    references: [],
    types: []
  };
}

export function emptySemanticFactBag(): GagcodeSemanticFactBag {
  return {
    calls: [],
    fieldReads: [],
    fieldWrites: [],
    definitions: [],
    references: [],
    types: []
  };
}

export class GagcodeIdFactory {
  private counts = new Map<string, number>();

  next(prefix: string): string {
    const nextValue = (this.counts.get(prefix) ?? 0) + 1;
    this.counts.set(prefix, nextValue);
    return `${prefix}:${nextValue}`;
  }
}
