# gagcode

Use this skill when a user asks to understand an existing codebase, build a semantic map of code behavior, inspect capabilities and flows, or render code understanding through the `gagcode` browser viewer.

## Purpose

`gagcode` is the deterministic CLI layer. It does not own AI inference.

The agent owns semantic interpretation:

- infer capabilities
- infer flows
- infer states
- infer constraints
- infer impacts
- explain evidence and uncertainty
- write semantic overlays back to `.gagcode`

## Workflow

1. Prepare the workspace: run `gagcode init` if `.gagcode/gagcode.config.json` is missing, then run `gagcode scan` and read `.gagcode/gagcode.summary.json`.
2. Inspect source entry points: read README, package/config files, routes, commands, or user-mentioned files to identify initial topics and likely capabilities.
3. Retrieve related evidence: use `gagcode query <topic>` to expand from those source-derived topics into candidate files, symbols, fields, calls, and graph neighborhoods.
4. Ground the reasoning: read source code around returned file and line evidence, then confirm or reject the retrieved hints against actual source behavior.
5. Infer and write semantic artifacts:
   - `.gagcode/semantic/gagcode.capabilities.json`
   - `.gagcode/semantic/gagcode.flows.json`
   - `.gagcode/semantic/gagcode.states.json`
   - `.gagcode/semantic/gagcode.constraints.json`
   - `.gagcode/semantic/gagcode.impacts.json`
6. Validate and render: run `gagcode validate`; if it fails, fix the invalid artifact and rerun validation before presenting finalized claims or running `gagcode serve`.

## Rules

- Do not claim that `gagcode` performed AI reasoning.
- Keep source code and `.gagcode` artifacts as the SSOT, but treat source code as the behavioral ground truth.
- Use `gagcode query` and indexes as navigation aids; do not load `.gagcode/facts/*.json` wholesale unless debugging `gagcode`.
- Write semantic claims only with source evidence and confidence; prefer low confidence over unsupported certainty.
- Ask the user to confirm low-confidence capability names, state machines, and business constraints.
- Treat `gagcode validate` failure as a blocking artifact issue. Fix the artifact or report the unresolved validation error.

## Semantic Artifact Shape

Capabilities should be concise user-visible system abilities:

```json
[
  {
    "id": "capability:upload-document",
    "name": "Upload Document",
    "summary": "Accepts a user file and creates a document record.",
    "entries": ["entry:1"],
    "flows": ["flow:upload-document"],
    "primaryEntities": ["Document"],
    "evidence": ["src/upload.ts:12"],
    "confidence": "medium"
  }
]
```

Flows should compress implementation calls into semantic steps:

```json
[
  {
    "id": "flow:upload-document",
    "capabilityId": "capability:upload-document",
    "name": "Upload Document",
    "nodes": [
      {
        "id": "node:validate-file",
        "type": "Validation",
        "label": "Validate File",
        "evidence": ["src/upload.ts:18"]
      }
    ],
    "edges": [],
    "confidence": "medium"
  }
]
```

States should capture explicit or inferred lifecycle fields:

```json
[
  {
    "id": "state:document-status",
    "entity": "Document",
    "field": "status",
    "type": "explicit",
    "values": ["pending", "processing", "indexed", "failed"],
    "transitions": [
      {
        "from": "pending",
        "to": "processing",
        "event": "Start indexing",
        "evidence": ["src/indexer.ts:34"]
      }
    ],
    "flows": ["flow:upload-document"],
    "evidence": ["src/document.ts:8", "src/indexer.ts:34"],
    "confidence": "medium"
  }
]
```

Constraints should identify rules that can break behavior if changed:

```json
[
  {
    "id": "constraint:file-size",
    "type": "Validation",
    "rule": "Uploaded files must stay below the configured size limit.",
    "target": "Upload Document",
    "evidence": ["src/upload.ts:21"],
    "confidence": "medium"
  }
]
```

Impacts should capture what changes when a source object changes:

```json
[
  {
    "id": "impact:document-status",
    "source": "Document.status",
    "affectedCapabilities": ["capability:upload-document", "capability:search-documents"],
    "affectedFlows": ["flow:upload-document"],
    "affectedFiles": ["src/indexer.ts", "src/search.ts"],
    "riskLevel": "high",
    "reason": "The field controls indexing lifecycle and search visibility.",
    "evidence": ["src/indexer.ts:34", "src/search.ts:19"],
    "confidence": "medium"
  }
]
```
