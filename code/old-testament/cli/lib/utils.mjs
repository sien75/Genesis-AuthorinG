import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEPTH_PRIORITY = { deep: 3, mapped: 2, ignored: 1 };

export function fileHash(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

export function countLines(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  if (content.length === 0) return 0;
  return content.split('\n').length;
}

export function mergeRanges(existing, newRange) {
  const all = [...existing, newRange];
  const lines = new Map();

  for (const r of all) {
    const priority = DEPTH_PRIORITY[r.depth] || 0;
    for (let i = r.start; i <= r.end; i++) {
      const cur = lines.get(i);
      if (!cur || DEPTH_PRIORITY[cur] < priority) {
        lines.set(i, r.depth);
      }
    }
  }

  if (lines.size === 0) return [];

  const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]);
  const ranges = [];
  let start = sorted[0][0];
  let depth = sorted[0][1];

  for (let i = 1; i < sorted.length; i++) {
    const [line, d] = sorted[i];
    if (line === sorted[i - 1][0] + 1 && d === depth) continue;
    ranges.push({ start, end: sorted[i - 1][0], depth });
    start = line;
    depth = d;
  }
  ranges.push({ start, end: sorted[sorted.length - 1][0], depth });

  return ranges;
}
