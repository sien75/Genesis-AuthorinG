---
name: gagcode-analyzer
description: |
  Analyze existing codebases using gagcode CLI for fact extraction, then infer semantic artifacts (capabilities, flows, states, constraints, impacts). Use when user asks to understand a project, map capabilities, trace flows, or assess impact.
---

# gagcode-analyzer

gagcode is a code understanding system: deterministic CLI extracts facts, AI agent infers meaning.

## CLI Commands

```bash
gagcode init          # Create .gagcode/ directory structure and config
gagcode scan          # Extract facts from source code → .gagcode/facts/ + indexes
gagcode query <text>  # Search facts by keyword (returns symbols, calls, graph neighbors)
```

`gagcode scan` produces:
- `.gagcode/facts/` — files, entries, symbols, imports, calls, field-reads, field-writes, definitions, references, types
- `.gagcode/index/` — structured-index, graph-index, vector-index
- `.gagcode/gagcode.summary.json` — counts and metadata

## AI Agent Workflow

### Step 1: Ensure facts exist

1. If `.gagcode/gagcode.config.json` does not exist, run `gagcode init`.
2. If `.gagcode/facts/gagcode.files.json` does not exist or is empty, run `gagcode scan`.
3. Confirm scan succeeded by checking that `.gagcode/gagcode.summary.json` exists.

### Step 2: Orient

Now that facts are generated:

1. Read `.gagcode/gagcode.summary.json` — understand scale and languages
2. Read project README or package.json — understand domain
3. Browse source code structure (directories, entry files, route files) to identify capabilities

### Step 3: Infer Semantic Artifacts

Process in order: **capabilities → flows → states → constraints → impacts**.

For each artifact type:
1. Read source code to understand behavior (code is ground truth)
2. Use `gagcode query <keyword>` to locate related symbols, calls, and references
3. Write results to the corresponding `.gagcode/semantic/gagcode.{type}.json` file (e.g. `gagcode.capabilities.json`, `gagcode.flows.json`, `gagcode.states.json`, `gagcode.constraints.json`, `gagcode.impacts.json`) — these are created by `gagcode init`

For large projects (50+ entries): batch by 5-8 related entries at a time.

### Step 4: Present

Show the user a capability map. Offer to drill into flows, states, or constraints.

## Rules

- Every claim must have `evidence` (file:line). No evidence → don't write it.
- Every artifact must have `confidence` (high/medium/low).
- Use `gagcode query` for navigation. Don't load entire fact files.
- If confidence is low, ask the user to confirm.
- gagcode CLI does not do AI. You did the inference; gagcode provided facts.

## Semantic Artifact Schemas

### Capability

```json
{
  "id": "capability:upload-document",
  "name": "Upload Document",
  "summary": "Accepts a user file and creates a document record.",
  "category": "data|auth|integration|admin|user|system",
  "entries": ["entry:1"],
  "flows": ["flow:upload-document"],
  "primaryEntities": ["Document"],
  "evidence": ["src/upload.ts:12"],
  "confidence": "high|medium|low"
}
```

### Flow

```json
{
  "id": "flow:upload-document",
  "capabilityId": "capability:upload-document",
  "name": "Upload Document",
  "entry": "src/upload.ts:handleUpload",
  "nodes": [
    {
      "id": "node:upload-document:validate-file",
      "type": "Validation",
      "label": "Validate File",
      "evidence": ["src/upload.ts:18"]
    }
  ],
  "edges": [
    {
      "id": "edge:upload-document:1",
      "from": "node:upload-document:validate-file",
      "to": "node:upload-document:save-file",
      "label": "valid",
      "condition": "validation passes",
      "evidence": ["src/upload.ts:22"]
    }
  ],
  "inputs": ["file: Buffer", "projectId: string"],
  "outputs": ["documentId: string"],
  "sideEffects": ["S3 upload", "index job queued"],
  "evidence": ["src/upload.ts:12"],
  "confidence": "high|medium|low"
}
```

**Node types:** Entry, Input, Validation, Permission, Transform, Decision, StateChange, Persist, ExternalCall, Event, Queue, Response, Error

**Edge rules:** Every non-Entry node needs an incoming edge. Decision nodes should have 2+ outgoing edges. Edges form a DAG.

### State

```json
{
  "id": "state:document-status",
  "entity": "Document",
  "field": "status",
  "type": "explicit|implicit|boolean|timestamp",
  "values": ["pending", "processing", "indexed", "failed"],
  "transitions": [
    {
      "from": "pending",
      "to": "processing",
      "event": "Start indexing",
      "condition": "document.status === 'pending'",
      "writer": "src/indexer.ts:startIndexing",
      "flowNode": "node:index-document:start-processing",
      "evidence": ["src/indexer.ts:34"],
      "confidence": "high"
    }
  ],
  "flows": ["flow:upload-document"],
  "evidence": ["src/document.ts:8"],
  "confidence": "high|medium|low"
}
```

### Constraint

```json
{
  "id": "constraint:file-size-limit",
  "type": "Permission|Validation|StateGuard|Consistency|Resource|Security|BusinessRule",
  "rule": "Uploaded files must be under 50MB.",
  "target": "Upload Document",
  "failureBehavior": "Returns 400 with error message",
  "attachedToFlowNode": "node:upload-document:validate-file",
  "evidence": ["src/upload.ts:21"],
  "confidence": "high|medium|low"
}
```

### Impact

```json
{
  "id": "impact:document-status",
  "source": "Document.status",
  "sourceType": "field|function|config|entity|event|route",
  "affectedCapabilities": ["capability:upload-document", "capability:search-documents"],
  "affectedFlows": ["flow:upload-document", "flow:index-document"],
  "affectedFiles": ["src/indexer.ts", "src/search.ts"],
  "riskLevel": "high|medium|low",
  "reason": "Controls indexing lifecycle and search visibility.",
  "evidence": ["src/indexer.ts:34", "src/search.ts:19"],
  "confidence": "high|medium|low"
}
```
