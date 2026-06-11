export function emptyFactBag() {
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
export function emptySemanticFactBag() {
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
    counts = new Map();
    next(prefix) {
        const nextValue = (this.counts.get(prefix) ?? 0) + 1;
        this.counts.set(prefix, nextValue);
        return `${prefix}:${nextValue}`;
    }
}
