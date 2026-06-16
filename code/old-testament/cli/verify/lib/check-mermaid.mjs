/**
 * Validate mermaid syntax and extract node IDs.
 *
 * - flowchart/graph: use mermaid + jsdom for syntax validation, regex for node ID extraction
 * - other types: use @mermaid-js/parser for both
 */

import { parse } from '@mermaid-js/parser';
import { JSDOM } from 'jsdom';

const PARSER_DIAGRAM_TYPES = new Set(['info', 'packet', 'pie', 'architecture', 'gitGraph', 'radar']);
const FLOWCHART_DIAGRAM_TYPES = new Set(['graph', 'flowchart']);
const DIAGRAM_HEADER_RE = /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4(?:Context|Container|Component|Dynamic|Deployment)|info|packet|architecture|radar(?:-beta)?)(?:\s|$)/;

let mermaidInstance = null;

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost'
  });
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: dom.window.navigator
  });
  global.DOMParser = dom.window.DOMParser;
  global.XMLSerializer = dom.window.XMLSerializer;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false });
  mermaidInstance = mermaid;
  return mermaid;
}

export async function checkMermaidBlock(code, blockIndex) {
  const errors = [];
  let nodeIds = [];
  const diagramHeaders = getDiagramHeaders(code);

  if (diagramHeaders.length > 1) {
    errors.push({
      type: 'error',
      rule: 'mermaid-single-diagram',
      message: `Mermaid block #${blockIndex + 1}: expected one diagram per block, found ${diagramHeaders.length} (${diagramHeaders.join(', ')})`
    });
    return { errors, nodeIds };
  }

  const diagramType = getDiagramType(code);

  if (FLOWCHART_DIAGRAM_TYPES.has(diagramType)) {
    // Syntax validation via mermaid main package
    try {
      const mermaid = await getMermaid();
      await mermaid.parse(code);
    } catch (e) {
      const msg = e.message || String(e);
      errors.push({
        type: 'error',
        rule: 'mermaid-syntax',
        message: `Mermaid block #${blockIndex + 1}: syntax error — ${msg}`
      });
      return { errors, nodeIds };
    }

    // Node ID extraction via regex (parser doesn't support flowchart)
    nodeIds = extractFlowchartNodeIds(code);
    addNodeCountWarning(errors, nodeIds, blockIndex);
    return { errors, nodeIds };
  }

  if (!PARSER_DIAGRAM_TYPES.has(diagramType)) {
    errors.push({
      type: 'error',
      rule: 'mermaid-syntax',
      message: `Mermaid block #${blockIndex + 1}: unsupported diagram type "${diagramType || 'unknown'}"`
    });
    return { errors, nodeIds };
  }

  // AST-based validation for supported types
  let ast;
  try {
    ast = await parse(diagramType, code);
  } catch (e) {
    const msg = e.message || String(e);
    errors.push({
      type: 'error',
      rule: 'mermaid-syntax',
      message: `Mermaid block #${blockIndex + 1}: syntax error — ${msg}`
    });
    return { errors, nodeIds };
  }

  nodeIds = extractNodeIdsFromAst(ast);
  addNodeCountWarning(errors, nodeIds, blockIndex);

  return { errors, nodeIds };
}

function getDiagramType(code) {
  const line = code
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l && !l.startsWith('%%') && !l.startsWith('---'));

  if (!line) return '';
  return line.split(/\s+/)[0];
}

function getDiagramHeaders(code) {
  return code
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('%%') && !l.startsWith('---') && DIAGRAM_HEADER_RE.test(l))
    .map(l => l.split(/\s+/)[0]);
}

function addNodeCountWarning(errors, nodeIds, blockIndex) {
  if (nodeIds.length > 40) {
    errors.push({
      type: 'warning',
      rule: 'node-count',
      message: `Mermaid block #${blockIndex + 1}: ${nodeIds.length} nodes (max 40)`
    });
  }
}

function extractNodeIdsFromAst(ast) {
  const ids = new Set();

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'flowchart') {
      walkStatements(node.body);
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const value of Object.values(node)) {
      walk(value);
    }
  }

  function walkStatements(statements) {
    if (!Array.isArray(statements)) return;
    for (const stmt of statements) {
      if (!stmt) continue;
      if (stmt.type === 'edge') {
        collectFromEdge(stmt);
      }
      if (stmt.type === 'subgraph') {
        walkStatements(stmt.body);
      }
      if (stmt.id) {
        ids.add(stmt.id);
      }
    }
  }

  function collectFromEdge(edge) {
    if (edge.left && edge.left.id) {
      ids.add(edge.left.id);
    }
    if (Array.isArray(edge.right)) {
      for (const r of edge.right) {
        if (r.node && r.node.id) {
          ids.add(r.node.id);
        }
      }
    }
    if (edge.right && edge.right.id) {
      ids.add(edge.right.id);
    }
  }

  walk(ast);
  return [...ids];
}

function extractFlowchartNodeIds(code) {
  const ids = new Set();
  const lines = code.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = stripFlowchartLine(rawLine);
    if (!line || isFlowchartHeader(line)) continue;

    for (const segment of splitFlowchartStatement(line)) {
      const id = extractFlowchartNodeId(segment);
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

function stripFlowchartLine(line) {
  return line
    .replace(/%%.*$/, '')
    .replace(/"[^"]*"/g, '""')
    .replace(/\|[^|]*\|/g, '')
    .trim();
}

function isFlowchartHeader(line) {
  return /^(?:graph|flowchart|direction)\b/.test(line) || /^end\b/.test(line) || /^subgraph\b/.test(line);
}

function splitFlowchartStatement(line) {
  return line
    .split(/<-->|-->|<--|---|==>|===|-\.->|-\.-/)
    .map(part => part.trim())
    .filter(Boolean);
}

function extractFlowchartNodeId(segment) {
  const match = segment.match(/^([A-Za-z_][\w-]*)\b/);
  return match ? match[1] : null;
}
