import Parser from "tree-sitter";
import { createRequire } from "node:module";
import path from "node:path";
import { emptyFactBag } from "./gagcode-adapters.js";
const require = createRequire(import.meta.url);
const JavaScript = require("tree-sitter-javascript");
const TypeScript = require("tree-sitter-typescript");
const Python = require("tree-sitter-python");
const Go = require("tree-sitter-go");
const TREE_SITTER_LANGUAGES = [
    { extensions: [".js", ".jsx", ".mjs", ".cjs"], language: JavaScript },
    { extensions: [".ts"], language: TypeScript.typescript },
    { extensions: [".tsx"], language: TypeScript.tsx },
    { extensions: [".py"], language: Python },
    { extensions: [".go"], language: Go }
];
export function createTreeSitterSyntaxAdapter(idFactory) {
    return {
        id: "tree-sitter",
        supports(relativePath) {
            return Boolean(languageFor(relativePath));
        },
        analyzeFile(input) {
            const language = languageFor(input.relativePath);
            if (!language) {
                return emptyFactBag();
            }
            const parser = new Parser();
            parser.setLanguage(language);
            const tree = parser.parse(input.text);
            const bag = emptyFactBag();
            walk(tree.rootNode, (node) => collectSyntaxFact(node, input.relativePath, bag, idFactory));
            return bag;
        }
    };
}
function languageFor(relativePath) {
    const extension = path.extname(relativePath);
    return TREE_SITTER_LANGUAGES.find((candidate) => candidate.extensions.includes(extension))?.language;
}
function collectSyntaxFact(node, file, bag, idFactory) {
    const line = node.startPosition.row + 1;
    const evidence = compactEvidence(node.text);
    if (isDeclaration(node)) {
        const name = declarationName(node);
        if (name) {
            const kind = symbolKind(node);
            bag.symbols.push({
                id: idFactory.next("symbol"),
                kind,
                name,
                file,
                line,
                evidence,
                source: "tree-sitter"
            });
            bag.definitions.push({
                id: idFactory.next("definition"),
                kind,
                name,
                file,
                line,
                evidence,
                source: "tree-sitter"
            });
        }
    }
    if (isTypeDeclaration(node)) {
        const name = declarationName(node);
        if (name) {
            bag.types.push({
                id: idFactory.next("type"),
                kind: typeKind(node),
                name,
                file,
                line,
                text: evidence,
                values: literalValues(node),
                source: "tree-sitter"
            });
        }
    }
    if (isImport(node)) {
        bag.imports.push({
            id: idFactory.next("import"),
            from: importSource(node),
            imported: importedNames(node),
            file,
            line,
            evidence,
            source: "tree-sitter"
        });
    }
    if (isCall(node)) {
        const callee = callName(node);
        if (callee) {
            bag.calls.push({
                id: idFactory.next("call"),
                callee,
                file,
                line,
                evidence,
                source: "tree-sitter"
            });
            const entryKind = entryKindForCall(callee, node);
            if (entryKind) {
                bag.entries.push({
                    id: idFactory.next("entry"),
                    kind: entryKind,
                    name: evidence.slice(0, 120),
                    file,
                    line,
                    evidence,
                    confidence: "medium",
                    source: "tree-sitter"
                });
            }
        }
    }
    if (isMemberAccess(node)) {
        const access = memberAccess(node);
        if (access) {
            const target = isWriteTarget(node) ? bag.fieldWrites : bag.fieldReads;
            target.push({
                id: idFactory.next(isWriteTarget(node) ? "fieldWrite" : "fieldRead"),
                object: access.object,
                field: access.field,
                file,
                line,
                evidence,
                source: "tree-sitter"
            });
        }
    }
}
function walk(node, visit) {
    visit(node);
    for (const child of node.namedChildren) {
        walk(child, visit);
    }
}
function isDeclaration(node) {
    return [
        "function_declaration",
        "generator_function_declaration",
        "class_declaration",
        "method_definition",
        "lexical_declaration",
        "variable_declaration",
        "interface_declaration",
        "type_alias_declaration",
        "enum_declaration",
        "function_definition",
        "class_definition",
        "function_declaration",
        "method_declaration",
        "type_declaration"
    ].includes(node.type);
}
function isTypeDeclaration(node) {
    return [
        "interface_declaration",
        "type_alias_declaration",
        "enum_declaration",
        "class_declaration",
        "type_declaration",
        "class_definition"
    ].includes(node.type);
}
function isImport(node) {
    return ["import_statement", "import_from_statement", "import_declaration"].includes(node.type);
}
function isCall(node) {
    return ["call_expression", "call"].includes(node.type);
}
function isMemberAccess(node) {
    return ["member_expression", "attribute", "selector_expression"].includes(node.type);
}
function declarationName(node) {
    const fieldName = node.childForFieldName("name")?.text;
    if (fieldName) {
        return stripQuotes(fieldName);
    }
    const named = node.namedChildren.find((child) => ["identifier", "property_identifier", "type_identifier"].includes(child.type));
    return named ? stripQuotes(named.text) : undefined;
}
function symbolKind(node) {
    if (node.type.includes("class"))
        return "class";
    if (node.type.includes("interface"))
        return "interface";
    if (node.type.includes("enum"))
        return "enum";
    if (node.type.includes("type"))
        return "type";
    if (node.type.includes("method"))
        return "method";
    if (node.type.includes("lexical") || node.type.includes("variable"))
        return "constant";
    return "function";
}
function typeKind(node) {
    if (node.type.includes("interface"))
        return "interface";
    if (node.type.includes("enum"))
        return "enum";
    if (node.type.includes("class"))
        return "class";
    return "type";
}
function importSource(node) {
    const stringNode = node.descendantsOfType(["string", "interpreted_string_literal", "raw_string_literal"]).at(-1);
    return stringNode ? stripQuotes(stringNode.text) : "";
}
function importedNames(node) {
    return node
        .descendantsOfType(["import_specifier", "identifier", "property_identifier"])
        .map((child) => stripQuotes(child.text))
        .filter((name) => name && !name.includes("\"") && !name.includes("'"))
        .slice(0, 30);
}
function callName(node) {
    const fn = node.childForFieldName("function") ?? node.childForFieldName("call");
    if (fn) {
        return normalizeCallee(fn.text);
    }
    return normalizeCallee(node.firstNamedChild?.text ?? "");
}
function entryKindForCall(callee, node) {
    if (/^(app|router)\.(get|post|put|patch|delete)$/i.test(callee))
        return "http-route";
    if (/^(describe|it|test)$/i.test(callee))
        return "test";
    if (/^(program|command)\.?/.test(callee) || /\.command$/.test(callee))
        return "cli-command";
    if (node.text.includes("onClick") || node.text.includes("onSubmit"))
        return "ui-action";
    return undefined;
}
function memberAccess(node) {
    const object = node.childForFieldName("object")?.text ?? node.childForFieldName("operand")?.text;
    const property = node.childForFieldName("property")?.text ??
        node.childForFieldName("field")?.text ??
        node.namedChildren.at(-1)?.text;
    if (!property) {
        return undefined;
    }
    return { object: object ? normalizeCallee(object) : undefined, field: stripQuotes(property) };
}
function isWriteTarget(node) {
    const parent = node.parent;
    if (!parent || !["assignment_expression", "assignment_statement", "augmented_assignment_expression", "augmented_assignment"].includes(parent.type)) {
        return false;
    }
    const left = parent.childForFieldName("left");
    return left?.id === node.id || Boolean(left?.descendantsOfType(node.type).some((candidate) => candidate.id === node.id));
}
function literalValues(node) {
    const values = node
        .descendantsOfType(["string", "string_fragment", "interpreted_string_literal", "raw_string_literal"])
        .map((child) => stripQuotes(child.text))
        .filter(Boolean);
    return values.length > 0 ? Array.from(new Set(values)).slice(0, 50) : undefined;
}
function normalizeCallee(value) {
    return value.replace(/\s+/g, "").slice(0, 160);
}
function stripQuotes(value) {
    return value.replace(/^['"`]/, "").replace(/['"`]$/, "");
}
function compactEvidence(value) {
    return value.replace(/\s+/g, " ").trim().slice(0, 240);
}
