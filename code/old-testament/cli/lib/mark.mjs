import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileHash, mergeRanges } from './utils.mjs';

export function mark(targetDir, file, rangeStr, depth) {
  const resolved = targetDir || process.cwd();
  const otDir = join(resolved, '.ot');

  const filesData = JSON.parse(readFileSync(join(otDir, 'files.json'), 'utf-8'));
  const coverageData = JSON.parse(readFileSync(join(otDir, 'coverage.json'), 'utf-8'));

  const fileEntry = filesData.files.find(f => f.path === file);
  if (!fileEntry) {
    console.error(`Error: file "${file}" not found in .ot/files.json`);
    process.exit(1);
  }

  const match = rangeStr.match(/^(\d+)-(\d+)$/);
  if (!match) {
    console.error(`Error: invalid range "${rangeStr}", expected format: startLine-endLine`);
    process.exit(1);
  }

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);

  if (start < 1 || end > fileEntry.lines || start > end) {
    console.error(`Error: range ${start}-${end} out of bounds (file has ${fileEntry.lines} lines)`);
    process.exit(1);
  }

  if (!['deep', 'mapped', 'ignored'].includes(depth)) {
    console.error(`Error: invalid depth "${depth}", expected: deep|mapped|ignored`);
    process.exit(1);
  }

  const currentHash = fileHash(join(resolved, file));
  if (currentHash !== fileEntry.hash) {
    console.warn(`Warning: "${file}" has changed since init (hash mismatch)`);
  }

  let fileMark = coverageData.marks.find(m => m.file === file);
  if (!fileMark) {
    fileMark = { file, ranges: [], hash: currentHash };
    coverageData.marks.push(fileMark);
  }

  fileMark.ranges = mergeRanges(fileMark.ranges, { start, end, depth });
  fileMark.hash = currentHash;

  writeFileSync(join(otDir, 'coverage.json'), JSON.stringify(coverageData, null, 2) + '\n');

  const coveredLines = fileMark.ranges.reduce((s, r) => s + (r.end - r.start + 1), 0);
  console.log(`Marked ${file} ${start}-${end} as ${depth} (${coveredLines}/${fileEntry.lines} lines covered)`);
}
