import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileHash } from './utils.mjs';

export function status(targetDir, byFile) {
  const resolved = targetDir || process.cwd();
  const otDir = join(resolved, '.ot');

  if (!existsSync(join(otDir, 'files.json'))) {
    console.error('Error: .ot/files.json not found. Run "ot-coverage init" first.');
    process.exit(1);
  }

  const filesData = JSON.parse(readFileSync(join(otDir, 'files.json'), 'utf-8'));
  const coverageData = JSON.parse(readFileSync(join(otDir, 'coverage.json'), 'utf-8'));

  let totalLines = 0;
  let deepLines = 0;
  let mappedLines = 0;
  let ignoredLines = 0;
  let staleFiles = [];
  let uncoveredFiles = [];

  const fileDetails = [];

  for (const f of filesData.files) {
    const fullPath = join(resolved, f.path);
    let isStale = false;

    if (existsSync(fullPath)) {
      const currentHash = fileHash(fullPath);
      if (currentHash !== f.hash) isStale = true;
    } else {
      isStale = true;
    }

    if (isStale) {
      staleFiles.push(f.path);
      continue;
    }

    totalLines += f.lines;

    const mark = coverageData.marks.find(m => m.file === f.path);
    if (!mark || mark.ranges.length === 0) {
      uncoveredFiles.push(f.path);
      fileDetails.push({ path: f.path, lines: f.lines, deep: 0, mapped: 0, ignored: 0, uncovered: f.lines });
      continue;
    }

    let fDeep = 0, fMapped = 0, fIgnored = 0;
    for (const r of mark.ranges) {
      const count = r.end - r.start + 1;
      if (r.depth === 'deep') fDeep += count;
      else if (r.depth === 'mapped') fMapped += count;
      else if (r.depth === 'ignored') fIgnored += count;
    }

    deepLines += fDeep;
    mappedLines += fMapped;
    ignoredLines += fIgnored;

    const fUncovered = f.lines - fDeep - fMapped - fIgnored;
    fileDetails.push({ path: f.path, lines: f.lines, deep: fDeep, mapped: fMapped, ignored: fIgnored, uncovered: fUncovered });
  }

  const uncoveredLines = totalLines - deepLines - mappedLines - ignoredLines;
  const coveragePercent = totalLines > 0 ? ((deepLines + mappedLines + ignoredLines) / totalLines * 100).toFixed(1) : '0.0';
  const deepPercent = totalLines > 0 ? (deepLines / totalLines * 100).toFixed(1) : '0.0';

  console.log('=== Coverage Status ===');
  console.log(`Total lines:     ${totalLines}`);
  console.log(`Deep:            ${deepLines} (${deepPercent}%)`);
  console.log(`Mapped:          ${mappedLines}`);
  console.log(`Ignored:         ${ignoredLines}`);
  console.log(`Uncovered:       ${uncoveredLines}`);
  console.log(`Coverage:        ${coveragePercent}%`);

  if (staleFiles.length > 0) {
    console.log(`\nStale files (${staleFiles.length}, excluded from stats):`);
    for (const f of staleFiles) console.log(`  - ${f}`);
  }

  if (byFile) {
    console.log('\n=== By File ===');
    for (const d of fileDetails) {
      const pct = d.lines > 0 ? ((d.deep + d.mapped + d.ignored) / d.lines * 100).toFixed(1) : '0.0';
      console.log(`${pct}%\t${d.deep}d/${d.mapped}m/${d.ignored}i/${d.uncovered}u\t${d.path}`);
    }
  }

  if (uncoveredFiles.length > 0 && !byFile) {
    console.log(`\nUncovered files (${uncoveredFiles.length}):`);
    for (const f of uncoveredFiles) console.log(`  - ${f}`);
  }
}
