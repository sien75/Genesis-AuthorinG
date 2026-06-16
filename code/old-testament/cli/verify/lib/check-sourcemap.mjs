/**
 * Validate sourceMap structure and coverage against mermaid nodes.
 */

export function checkSourceMapFormat(sourceMapResult) {
  const errors = [];

  if (sourceMapResult.raw === null) {
    errors.push({
      type: 'error',
      rule: 'sourcemap-missing',
      message: 'No window.__sourceMap found in file'
    });
    return errors;
  }

  if (sourceMapResult.error) {
    errors.push({
      type: 'error',
      rule: 'sourcemap-json',
      message: `sourceMap is not valid JSON — ${sourceMapResult.error}`
    });
    return errors;
  }

  const map = sourceMapResult.parsed;
  for (const [nodeId, entry] of Object.entries(map)) {
    if (typeof entry !== 'object' || entry === null) {
      errors.push({
        type: 'error',
        rule: 'sourcemap-entry',
        message: `sourceMap["${nodeId}"]: expected object, got ${typeof entry}`
      });
      continue;
    }

    if (typeof entry.file !== 'string' || !entry.file) {
      errors.push({
        type: 'error',
        rule: 'sourcemap-field',
        message: `sourceMap["${nodeId}"]: missing or invalid "file" (expected non-empty string)`
      });
    }

    if (typeof entry.startLine !== 'number' || !Number.isInteger(entry.startLine) || entry.startLine < 1) {
      errors.push({
        type: 'error',
        rule: 'sourcemap-field',
        message: `sourceMap["${nodeId}"]: missing or invalid "startLine" (expected positive integer)`
      });
    }

    if (typeof entry.endLine !== 'number' || !Number.isInteger(entry.endLine) || entry.endLine < 1) {
      errors.push({
        type: 'error',
        rule: 'sourcemap-field',
        message: `sourceMap["${nodeId}"]: missing or invalid "endLine" (expected positive integer)`
      });
    }

    if (typeof entry.startLine === 'number' && typeof entry.endLine === 'number' && entry.startLine > entry.endLine) {
      errors.push({
        type: 'error',
        rule: 'sourcemap-range',
        message: `sourceMap["${nodeId}"]: startLine (${entry.startLine}) > endLine (${entry.endLine})`
      });
    }
  }

  return errors;
}

export function checkSourceMapCoverage(allMermaidNodeIds, sourceMapResult) {
  const errors = [];
  if (!sourceMapResult.parsed) return errors;

  const mapKeys = new Set(Object.keys(sourceMapResult.parsed));
  const missing = allMermaidNodeIds.filter(id => !mapKeys.has(id));

  if (missing.length > 0) {
    errors.push({
      type: 'error',
      rule: 'sourcemap-coverage',
      message: `${missing.length} mermaid node(s) missing from sourceMap: ${missing.join(', ')}`
    });
  }

  return errors;
}
