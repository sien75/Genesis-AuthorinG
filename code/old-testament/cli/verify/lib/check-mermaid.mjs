/**
 * Validate mermaid syntax and extract node IDs.
 */

import { parse } from '@mermaid-js/parser';

const PARSER_DIAGRAM_TYPES = new Set(['info', 'packet', 'pie', 'architecture', 'gitGraph', 'radar']);
const FLOWCHART_DIAGRAM_TYPES = new Set(['graph', 'flowchart']);

export async function checkMermaidBlock(code, blockIndex) {
  const errors = [];
  let nodeIds = [];
  const diagramType = getDiagramType(code);

  if (FLOWCHART_DIAGRAM_TYPES.has(diagramType)) {
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

  // 1. Syntax validation + AST extraction
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

  // 2. Extract node IDs from AST
  nodeIds = extractNodeIdsFromAst(ast);

  // 3. Node count check
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

    // flowchart/graph AST: nodes are in body statements
    if (node.type === 'flowchart') {
      walkStatements(node.body);
    }

    // Generic walk for unknown structures
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
      // Edge statement: has left node, right nodes, and chain
      if (stmt.type === 'edge') {
        collectFromEdge(stmt);
      }
      // Subgraph
      if (stmt.type === 'subgraph') {
        walkStatements(stmt.body);
      }
      // Direct node statement
      if (stmt.id) {
        ids.add(stmt.id);
      }
    }
  }

  function collectFromEdge(edge) {
    // An edge has nodes on the left and right
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
    // Some AST formats nest edges differently
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
