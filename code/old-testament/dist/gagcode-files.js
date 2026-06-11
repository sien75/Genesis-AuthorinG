import fs from "node:fs/promises";
import path from "node:path";
import { GAGCODE_DIR } from "./gagcode-paths.js";
const DEFAULT_EXCLUDES = new Set([
    ".git",
    GAGCODE_DIR,
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".cache"
]);
const LANGUAGE_BY_EXTENSION = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown"
};
export function languageForFile(filePath) {
    return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "Unknown";
}
export async function ensureJsonFile(filePath, value) {
    try {
        await fs.access(filePath);
    }
    catch {
        await writeJson(filePath, value);
    }
}
export async function readJson(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}
export async function writeJson(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
export async function walkCodeFiles(root) {
    const files = [];
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && DEFAULT_EXCLUDES.has(entry.name)) {
                continue;
            }
            const absolute = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(absolute);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const relative = path.relative(root, absolute);
            if (languageForFile(relative) !== "Unknown") {
                files.push(relative);
            }
        }
    }
    await walk(root);
    return files.sort();
}
