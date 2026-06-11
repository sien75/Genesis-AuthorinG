import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { emptySemanticFactBag } from "./gagcode-adapters.js";
const TS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
export function createTypeScriptSemanticAdapter(idFactory) {
    return {
        id: "typescript-compiler",
        supportsProject(_root, relativeFiles) {
            return relativeFiles.some((file) => TS_EXTENSIONS.has(path.extname(file)));
        },
        analyzeProject(input) {
            const files = input.relativeFiles
                .filter((file) => TS_EXTENSIONS.has(path.extname(file)))
                .map((file) => path.join(input.root, file));
            if (files.length === 0) {
                return emptySemanticFactBag();
            }
            const program = createProgram(input.root, files);
            const checker = program.getTypeChecker();
            const bag = emptySemanticFactBag();
            for (const sourceFile of program.getSourceFiles()) {
                if (sourceFile.isDeclarationFile || !isInsideRoot(input.root, sourceFile.fileName)) {
                    continue;
                }
                visitSourceFile(input.root, sourceFile, checker, bag, idFactory);
            }
            return bag;
        }
    };
}
function createProgram(root, fallbackFiles) {
    const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
    if (configPath) {
        const config = ts.readConfigFile(configPath, ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), {
            allowJs: true,
            checkJs: false,
            noEmit: true
        });
        return ts.createProgram({
            rootNames: parsed.fileNames.length > 0 ? parsed.fileNames : fallbackFiles,
            options: {
                ...parsed.options,
                allowJs: true,
                checkJs: false,
                noEmit: true,
                skipLibCheck: true
            }
        });
    }
    return ts.createProgram({
        rootNames: fallbackFiles,
        options: {
            allowJs: true,
            checkJs: false,
            noEmit: true,
            skipLibCheck: true,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            target: ts.ScriptTarget.ES2022
        }
    });
}
function visitSourceFile(root, sourceFile, checker, bag, idFactory) {
    const relative = path.relative(root, sourceFile.fileName);
    function visit(node) {
        collectDefinitionsAndTypes(root, sourceFile, node, checker, bag, idFactory);
        collectReferences(root, sourceFile, node, checker, bag, idFactory);
        collectCalls(root, sourceFile, node, checker, bag, idFactory);
        collectFieldAccess(root, sourceFile, node, checker, bag, idFactory);
        ts.forEachChild(node, visit);
    }
    if (!relative.startsWith("..")) {
        visit(sourceFile);
    }
}
function collectDefinitionsAndTypes(root, sourceFile, node, checker, bag, idFactory) {
    if (!hasName(node)) {
        return;
    }
    const name = node.name.getText(sourceFile);
    const kind = ts.SyntaxKind[node.kind];
    const type = safeTypeAt(checker, node.name, sourceFile);
    const location = locationFor(root, sourceFile, node);
    if (isDefinitionNode(node)) {
        bag.definitions.push({
            id: idFactory.next("definition"),
            name,
            kind,
            file: location.file,
            line: location.line,
            type,
            evidence: evidenceFor(sourceFile, node),
            source: "typescript-compiler"
        });
    }
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node) || ts.isClassDeclaration(node)) {
        bag.types.push({
            id: idFactory.next("type"),
            name,
            kind: ts.isInterfaceDeclaration(node)
                ? "interface"
                : ts.isEnumDeclaration(node)
                    ? "enum"
                    : ts.isClassDeclaration(node)
                        ? "class"
                        : "type",
            file: location.file,
            line: location.line,
            text: evidenceFor(sourceFile, node),
            values: ts.isEnumDeclaration(node) ? enumValues(node, sourceFile) : unionStringValues(node, sourceFile),
            source: "typescript-compiler"
        });
    }
}
const NOISE_GLOBALS = new Set([
    "console", "JSON", "Math", "Object", "Array", "Promise", "Map", "Set",
    "Error", "Number", "String", "Boolean", "Date", "RegExp", "Symbol",
    "undefined", "process", "parseInt", "parseFloat", "isNaN", "isFinite",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval", "Buffer"
]);
function collectReferences(root, sourceFile, node, checker, bag, idFactory) {
    if (!ts.isIdentifier(node)) {
        return;
    }
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) {
        return;
    }
    if (!symbol.declarations?.length && NOISE_GLOBALS.has(node.text)) {
        return;
    }
    const definition = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (definition) {
        const defSourceFile = definition.getSourceFile();
        if (defSourceFile === sourceFile) {
            return;
        }
    }
    const location = locationFor(root, sourceFile, node);
    bag.references.push({
        id: idFactory.next("reference"),
        name: node.text,
        definition: definition ? formatDefinition(root, definition) : undefined,
        file: location.file,
        line: location.line,
        evidence: evidenceFor(sourceFile, node),
        source: "typescript-compiler"
    });
}
function collectCalls(root, sourceFile, node, checker, bag, idFactory) {
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) {
        return;
    }
    const expression = node.expression;
    const symbol = checker.getSymbolAtLocation(expression);
    const definition = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    const location = locationFor(root, sourceFile, node);
    bag.calls.push({
        id: idFactory.next("call"),
        callee: expression.getText(sourceFile).replace(/\s+/g, ""),
        resolvedTo: definition ? formatDefinition(root, definition) : undefined,
        file: location.file,
        line: location.line,
        evidence: evidenceFor(sourceFile, node),
        source: "typescript-compiler"
    });
}
function collectFieldAccess(root, sourceFile, node, checker, bag, idFactory) {
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
        return;
    }
    const object = node.expression.getText(sourceFile);
    const field = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression?.getText(sourceFile);
    if (!field) {
        return;
    }
    const location = locationFor(root, sourceFile, node);
    const target = isWriteTarget(node) ? bag.fieldWrites : bag.fieldReads;
    target.push({
        id: idFactory.next(isWriteTarget(node) ? "fieldWrite" : "fieldRead"),
        object,
        field: field.replace(/^['"`]/, "").replace(/['"`]$/, ""),
        ownerType: safeTypeAt(checker, node.expression, sourceFile),
        file: location.file,
        line: location.line,
        evidence: evidenceFor(sourceFile, node),
        source: "typescript-compiler"
    });
}
function hasName(node) {
    return "name" in node && Boolean(node.name);
}
function isDefinitionNode(node) {
    return (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isParameter(node));
}
function isWriteTarget(node) {
    const parent = node.parent;
    if (!parent) {
        return false;
    }
    if (ts.isBinaryExpression(parent) && parent.left === node && assignmentOperators.has(parent.operatorToken.kind)) {
        return true;
    }
    if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && parent.operand === node) {
        return parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken;
    }
    return false;
}
const assignmentOperators = new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken
]);
function locationFor(root, sourceFile, node) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return {
        file: path.relative(root, sourceFile.fileName),
        line: position.line + 1
    };
}
function evidenceFor(sourceFile, node) {
    return node.getText(sourceFile).replace(/\s+/g, " ").trim().slice(0, 240);
}
function formatDefinition(root, node) {
    const sourceFile = node.getSourceFile();
    const location = locationFor(root, sourceFile, node);
    return `${location.file}:${location.line}`;
}
function safeTypeAt(checker, node, sourceFile) {
    try {
        return checker.typeToString(checker.getTypeAtLocation(node), node, ts.TypeFormatFlags.NoTruncation).slice(0, 240);
    }
    catch {
        return undefined;
    }
}
function enumValues(node, sourceFile) {
    return node.members.map((member) => member.name.getText(sourceFile));
}
function unionStringValues(node, sourceFile) {
    if (!ts.isTypeAliasDeclaration(node) || !ts.isUnionTypeNode(node.type)) {
        return undefined;
    }
    const values = node.type.types
        .map((typeNode) => (ts.isLiteralTypeNode(typeNode) ? typeNode.literal.getText(sourceFile) : undefined))
        .filter((value) => Boolean(value))
        .map((value) => value.replace(/^['"`]/, "").replace(/['"`]$/, ""));
    return values.length > 0 ? values : undefined;
}
function isInsideRoot(root, fileName) {
    const relative = path.relative(root, fileName);
    return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative) && fs.existsSync(fileName);
}
