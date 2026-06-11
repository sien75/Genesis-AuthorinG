---
name: gagcode
description: |
  Analyze existing codebases by inferring semantic artifacts (capabilities, flows, states, constraints, impacts) from gagcode facts. Use when user asks to understand a project, map capabilities, trace flows, find state machines, identify constraints, or assess impact of changes. Also use when the user mentions gagcode, .gagcode directory, or asks "what does this project do".
---

# gagcode Semantic Inference Skill

You are an AI agent responsible for turning deterministic code facts into human-understandable semantic artifacts. The `gagcode` CLI extracts facts; you infer meaning.

## When to Use

- User asks to understand an existing codebase
- User asks "what does this project do" or "what are the main capabilities"
- User asks about flows, state machines, constraints, or impact analysis
- User wants to generate or update `.gagcode/semantic/` artifacts
- User mentions gagcode or `.gagcode` directory

## Prerequisites

Before inference, ensure the deterministic layer is ready:

1. Check if `.gagcode/gagcode.config.json` exists. If not, run `gagcode init`.
2. Check if `.gagcode/facts/gagcode.files.json` exists and is non-empty. If not, run `gagcode scan`.
3. Read `.gagcode/gagcode.summary.json` to understand project scale.

## Workflow

Execute in this exact order. Do not skip steps.

### Step 1: Orient

Read these files to understand the project shape:

- `.gagcode/gagcode.summary.json` — file count, language breakdown, entry count
- Project README or package.json/pyproject.toml/go.mod — domain context
- `.gagcode/facts/gagcode.entries.json` — all detected entry points (routes, commands, tests, workers)

### Step 2: Infer Capabilities

A capability is a user-visible or system-visible thing the project does. Not a file, not a class — an action or ability.

**Strategy:**

1. Group entries by semantic similarity (e.g. all `/api/documents/*` routes → "Document Management")
2. Use `gagcode query <topic>` to find related symbols, calls, and types for each group
3. Read source code at entry evidence locations to confirm the capability exists
4. Name each capability in 2-4 words from the user's perspective
5. Aim for 5-20 capabilities per project. Fewer for small projects, more for large ones.

**Write to:** `.gagcode/semantic/gagcode.capabilities.json`

### Step 3: Infer Flows

For each capability, trace the main causal chain from entry to outcome.

**Strategy:**

1. Start from the capability's entry evidence (file:line)
2. Read that function/handler and follow its call chain
3. Use `gagcode query <function-name>` to find callees and their definitions
4. Compress implementation details into semantic steps (see Node Types below)
5. Stop at 5-12 nodes per flow. If longer, you're too granular.
6. Connect nodes with edges that show the progression and any conditions/branches.

**Write to:** `.gagcode/semantic/gagcode.flows.json`

### Step 4: Infer States

Look for lifecycle fields — things that change value over time and control behavior.

**Strategy:**

1. Search facts for status-like fields: `gagcode query "status"`, `gagcode query "state"`, `gagcode query "phase"`
2. Check `.gagcode/facts/gagcode.types.json` for enums and union types with lifecycle-like values
3. Find writes to those fields in `.gagcode/facts/gagcode.field-writes.json`
4. Find reads/conditions on those fields in source code
5. Build transition diagram from write evidence
6. If no dominant state machine exists, record that finding — do not fabricate one

**Write to:** `.gagcode/semantic/gagcode.states.json`

### Step 5: Infer Constraints

Constraints are rules that can break behavior if violated.

**Strategy:**

1. Look for validation patterns: `gagcode query "validate"`, `gagcode query "permission"`, `gagcode query "guard"`
2. Look at entries for middleware/guard patterns
3. Find throw/error patterns in flow paths
4. Classify each constraint by type (Permission, Validation, StateGuard, Resource, Security, BusinessRule)
5. Attach constraints to flow nodes where possible

**Write to:** `.gagcode/semantic/gagcode.constraints.json`

### Step 6: Infer Impacts

Impact answers "what breaks if I change this?"

**Strategy:**

1. For each state field and key entity, use `gagcode query <field-name>` to find all readers
2. Trace which capabilities and flows depend on that field
3. Assess risk level based on breadth of impact
4. Only create impact records for high-connectivity nodes (referenced by 3+ flows or capabilities)

**Write to:** `.gagcode/semantic/gagcode.impacts.json`

### Step 7: Validate

Run `gagcode validate`. If it fails, fix the artifact that caused the failure and rerun.

### Step 8: Present

Show the user a capability map (list of 5-20 capabilities with summaries). Offer to drill into any capability's flow, states, constraints, or impacts.

## Batching Strategy for Large Projects

If the project has more than 50 entries or 100 files:

- Do NOT try to infer all capabilities at once
- Process in batches of 5-8 related entries
- Use file path grouping as a first heuristic (e.g. `src/auth/*`, `src/documents/*`)
- Write partial results, then merge in subsequent passes
- Tell the user your progress: "Analyzed 3/7 capability groups so far"

## Schema Definitions

### Capability

```json
{
  "id": "capability:<kebab-name>",
  "name": "Human Readable Name",
  "summary": "One sentence describing what this capability does.",
  "category": "data|auth|integration|admin|user|system",
  "entries": ["entry:<id>"],
  "flows": ["flow:<id>"],
  "primaryEntities": ["Document", "User"],
  "evidence": ["src/upload.ts:12", "src/upload.route.ts:5"],
  "confidence": "high|medium|low"
}
```

**Category values:**
- `auth` — authentication, authorization, identity
- `data` — CRUD, storage, retrieval, search
- `integration` — external APIs, webhooks, sync
- `admin` — configuration, management, monitoring
- `user` — user-facing features, UI actions
- `system` — background jobs, queues, cron, infrastructure

### Flow

```json
{
  "id": "flow:<kebab-name>",
  "capabilityId": "capability:<kebab-name>",
  "name": "Human Readable Flow Name",
  "entry": "src/upload.ts:handleUpload",
  "nodes": [
    {
      "id": "node:<flow-id>:<kebab-name>",
      "type": "Entry|Input|Validation|Permission|Transform|Decision|StateChange|Persist|ExternalCall|Event|Queue|Response|Error",
      "label": "Human Readable Step",
      "description": "Optional one-line detail",
      "evidence": ["src/upload.ts:18"]
    }
  ],
  "edges": [
    {
      "id": "edge:<flow-id>:<index>",
      "from": "node:<flow-id>:<source>",
      "to": "node:<flow-id>:<target>",
      "label": "optional edge label",
      "condition": "optional condition expression",
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

**Node types (for renderer icon/color mapping):**

| Type | Meaning | Typical color |
|------|---------|---------------|
| Entry | Request/trigger arrives | blue |
| Input | Parse/extract input data | gray |
| Validation | Check input correctness | yellow |
| Permission | Check authorization | orange |
| Transform | Data transformation | purple |
| Decision | Branch/condition | diamond/yellow |
| StateChange | Mutate entity state | red |
| Persist | Write to database/storage | green |
| ExternalCall | Call external service | cyan |
| Event | Emit event/message | pink |
| Queue | Enqueue async job | indigo |
| Response | Return result | blue |
| Error | Error/exception path | red |

**Edge rules:**
- Every node except the entry must have at least one incoming edge
- Every node except terminal nodes (Response, Error) should have at least one outgoing edge
- Decision nodes should have 2+ outgoing edges with different conditions
- Edges form a DAG (no cycles in a single flow)

### State

```json
{
  "id": "state:<entity>-<field>",
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
  "reads": [
    {
      "file": "src/search.ts",
      "line": 19,
      "purpose": "filter indexed documents"
    }
  ],
  "flows": ["flow:upload-document", "flow:index-document"],
  "evidence": ["src/document.ts:8", "src/indexer.ts:34"],
  "confidence": "high|medium|low"
}
```

**State type classification:**
- `explicit` — enum/schema defines values + clear transition logic
- `implicit` — no unified declaration but code behavior shows lifecycle
- `boolean` — isDeleted, enabled, verified, locked
- `timestamp` — deletedAt, paidAt, startedAt (null → set = state change)

### Constraint

```json
{
  "id": "constraint:<kebab-name>",
  "type": "Permission|Validation|StateGuard|Consistency|Resource|Security|BusinessRule|FeatureFlag",
  "rule": "Human readable rule statement.",
  "target": "capability or flow node this constrains",
  "failureBehavior": "Returns 403|Throws ValidationError|Retries 3 times",
  "attachedToFlowNode": "node:upload-document:check-permission",
  "evidence": ["src/upload.ts:21", "src/auth.middleware.ts:8"],
  "confidence": "high|medium|low"
}
```

### Impact

```json
{
  "id": "impact:<source-name>",
  "source": "Document.status",
  "sourceType": "field|function|config|entity|event|route",
  "affectedCapabilities": ["capability:upload-document", "capability:search-documents"],
  "affectedFlows": ["flow:upload-document", "flow:index-document"],
  "affectedStates": ["state:document-status"],
  "affectedConstraints": ["constraint:only-index-pending"],
  "affectedFiles": ["src/indexer.ts", "src/search.ts"],
  "riskLevel": "high|medium|low",
  "reason": "One sentence explaining why this is impactful.",
  "evidence": ["src/indexer.ts:34", "src/search.ts:19"],
  "confidence": "high|medium|low"
}
```

**Risk level criteria:**
- `high` — affects 3+ capabilities, or touches state/permission/consistency constraints, or involves external contracts
- `medium` — affects 1-2 capabilities across multiple flow nodes, or affects shared helpers
- `low` — affects single leaf node, single file, or display-only code

## Hard Rules

1. **Evidence required.** Every claim must have at least one `evidence` entry pointing to `file:line`. No evidence → do not write the artifact.
2. **Confidence required.** Every artifact must have a confidence level. Default to `medium` if unsure. Use `low` if based on pattern matching alone without reading source.
3. **No hallucination.** If you cannot find evidence for a capability/flow/state, do not invent it. Report what you found and what you could not confirm.
4. **Source is ground truth.** If facts disagree with source code, trust source code. Facts are navigation aids, not behavioral proof.
5. **gagcode CLI does not do AI.** Never claim that gagcode itself inferred something. You (the agent) did the inference; gagcode provided the facts.
6. **Validate before presenting.** Always run `gagcode validate` before showing results to the user.
7. **Ask on low confidence.** If a capability name, state machine, or constraint classification has low confidence, ask the user to confirm before finalizing.
8. **Incremental over monolithic.** Write artifacts as you go. Do not accumulate everything in memory and dump at the end.
9. **IDs are stable.** Use kebab-case, descriptive IDs. Once written, do not rename IDs without updating all cross-references.
10. **Do not load facts wholesale.** Use `gagcode query` for navigation. Only read specific fact files when debugging gagcode itself.
