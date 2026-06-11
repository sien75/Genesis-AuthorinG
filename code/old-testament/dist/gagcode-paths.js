import path from "node:path";
export const GAGCODE_DIR = ".gagcode";
export function gagcodePaths(root) {
    const base = path.join(root, GAGCODE_DIR);
    const facts = path.join(base, "facts");
    const index = path.join(base, "index");
    const semantic = path.join(base, "semantic");
    return {
        base,
        facts,
        index,
        semantic,
        config: path.join(base, "gagcode.config.json"),
        summary: path.join(base, "gagcode.summary.json"),
        model: path.join(base, "gagcode.model.json"),
        files: path.join(facts, "gagcode.files.json"),
        entries: path.join(facts, "gagcode.entries.json"),
        symbols: path.join(facts, "gagcode.symbols.json"),
        imports: path.join(facts, "gagcode.imports.json"),
        calls: path.join(facts, "gagcode.calls.json"),
        fieldReads: path.join(facts, "gagcode.field-reads.json"),
        fieldWrites: path.join(facts, "gagcode.field-writes.json"),
        definitions: path.join(facts, "gagcode.definitions.json"),
        references: path.join(facts, "gagcode.references.json"),
        types: path.join(facts, "gagcode.types.json"),
        structuredIndex: path.join(index, "gagcode.structured-index.json"),
        graphIndex: path.join(index, "gagcode.graph-index.json"),
        vectorIndex: path.join(index, "gagcode.vector-index.json"),
        capabilities: path.join(semantic, "gagcode.capabilities.json"),
        flows: path.join(semantic, "gagcode.flows.json"),
        states: path.join(semantic, "gagcode.states.json"),
        constraints: path.join(semantic, "gagcode.constraints.json"),
        impacts: path.join(semantic, "gagcode.impacts.json")
    };
}
