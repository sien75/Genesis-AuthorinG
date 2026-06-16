#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractMermaidBlocks, extractSourceMap } from '../lib/extract.mjs';
import { checkMermaidBlock } from '../lib/check-mermaid.mjs';
import { checkSourceMapFormat, checkSourceMapCoverage } from '../lib/check-sourcemap.mjs';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'help' || command === '--help') {
  console.log(`ot-verify — Validate OT module HTML output

Usage:
  ot-verify [modulesDir]    Verify all module HTML files in the directory (default: .ot/modules)
  ot-verify help             Show this help

Checks:
  mermaid-syntax             Mermaid blocks can be parsed
  sourcemap-json             window.__sourceMap is valid JSON
  sourcemap-field            Each entry has file (string), startLine/endLine (positive integers)
  sourcemap-range            startLine <= endLine
  sourcemap-coverage         All mermaid nodes have a sourceMap entry
  node-count                 Each diagram has <= 40 nodes (warning)`);
  process.exit(0);
}

const modulesDir = resolve(command || '.ot/modules');

if (!existsSync(modulesDir)) {
  console.error(`Directory not found: ${modulesDir}`);
  process.exit(1);
}

const files = readdirSync(modulesDir).filter(f => f.endsWith('.html') && f !== 'index.html');

if (files.length === 0) {
  console.error(`No HTML files found in ${modulesDir}`);
  process.exit(1);
}

const report = { files: {}, summary: { total: 0, errors: 0, warnings: 0 } };

for (const file of files) {
  const filePath = join(modulesDir, file);
  const html = readFileSync(filePath, 'utf-8');
  const fileErrors = [];

  // 1. Extract and check mermaid blocks
  const mermaidBlocks = extractMermaidBlocks(html);
  const allNodeIds = [];

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const { errors, nodeIds } = await checkMermaidBlock(mermaidBlocks[i], i);
    fileErrors.push(...errors);
    allNodeIds.push(...nodeIds);
  }

  if (mermaidBlocks.length === 0) {
    fileErrors.push({
      type: 'warning',
      rule: 'no-mermaid',
      message: 'No mermaid blocks found in file'
    });
  }

  // 2. Extract and check sourceMap
  const sourceMapResult = extractSourceMap(html);
  fileErrors.push(...checkSourceMapFormat(sourceMapResult));

  // 3. Check sourceMap covers all mermaid nodes
  if (allNodeIds.length > 0 && sourceMapResult.parsed) {
    fileErrors.push(...checkSourceMapCoverage(allNodeIds, sourceMapResult));
  }

  report.files[file] = {
    mermaidBlocks: mermaidBlocks.length,
    mermaidNodes: allNodeIds.length,
    sourceMapKeys: sourceMapResult.parsed ? Object.keys(sourceMapResult.parsed).length : 0,
    issues: fileErrors
  };

  report.summary.total += fileErrors.length;
  report.summary.errors += fileErrors.filter(e => e.type === 'error').length;
  report.summary.warnings += fileErrors.filter(e => e.type === 'warning').length;
}

// Console output
console.log(`\nVerification Report`);
console.log(`===================\n`);

for (const [file, result] of Object.entries(report.files)) {
  const status = result.issues.length === 0 ? 'PASS' : 'FAIL';
  console.log(`${status}  ${file}  (${result.mermaidBlocks} diagrams, ${result.mermaidNodes} nodes, ${result.sourceMapKeys} mappings)`);
  for (const issue of result.issues) {
    const prefix = issue.type === 'error' ? '  ERROR' : '  WARN ';
    console.log(`${prefix}  [${issue.rule}] ${issue.message}`);
  }
}

console.log(`\nTotal: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s)`);

if (report.summary.errors > 0) {
  process.exit(1);
}
