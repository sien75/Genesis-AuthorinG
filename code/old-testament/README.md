# gagcode

`gagcode` is the code-domain CLI for Genesis AuthorinG.

It treats an existing codebase as an SSOT made of:

- native code assets
- `.gagcode` analysis artifacts

Browser views are derived from the SSOT. Agent-authored semantic overlays are written into `.gagcode/semantic`, so they are part of the `.gagcode` artifact set rather than a separate SSOT component.

The CLI intentionally avoids built-in AI inference. It extracts deterministic facts and stores them in `.gagcode`. Codex or Claude Code skills read those facts, use agent AI to infer capabilities and flows, then write semantic artifacts back into `.gagcode/semantic`.

## Commands

```bash
gagcode init
gagcode scan
gagcode query "Document status"
gagcode uninstall
```

## Install From GitHub

Install directly from GitHub without publishing to npm:

```bash
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/scripts/install.sh | sh
```

The installer downloads the repository tarball, builds `code/old-testament`, installs it under `~/.gagcode/cli`, and links `gagcode` into `~/.local/bin`.

Override defaults when needed:

```bash
GAGCODE_REF=main \
GAGCODE_INSTALL_DIR="$HOME/.gagcode/cli" \
GAGCODE_BIN_DIR="$HOME/.local/bin" \
sh -c "$(curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/scripts/install.sh)"
```

Uninstall removes the installed CLI directory and the `gagcode` symlink created by the installer:

```bash
gagcode uninstall
```

If you installed with custom paths, pass the same overrides:

```bash
GAGCODE_INSTALL_DIR="$HOME/.gagcode/cli" \
GAGCODE_BIN_DIR="$HOME/.local/bin" \
gagcode uninstall
```

## Artifact Layout

```text
.gagcode/
  gagcode.config.json
  gagcode.summary.json
  facts/
    gagcode.files.json
    gagcode.entries.json
    gagcode.symbols.json
    gagcode.imports.json
    gagcode.calls.json
    gagcode.field-reads.json
    gagcode.field-writes.json
    gagcode.definitions.json
    gagcode.references.json
    gagcode.types.json
  index/
    gagcode.structured-index.json
    gagcode.graph-index.json
    gagcode.vector-index.json
  semantic/
    gagcode.capabilities.json
    gagcode.flows.json
    gagcode.states.json
    gagcode.constraints.json
    gagcode.impacts.json
```

## Boundary

`gagcode` owns deterministic code facts.

Agent skills own semantic interpretation:

```text
codebase
  -> gagcode scan
  -> .gagcode/facts/*
  -> Codex / Claude Code skill
  -> .gagcode/semantic/*
```

## Fact Extraction Phases

Phase 1 uses tree-sitter syntax adapters for multi-language facts:

- TypeScript / TSX
- JavaScript / JSX
- Python
- Go

These adapters extract declarations, imports, calls, field reads and field writes from syntax trees. Rust, Java, and other languages should be added as additional syntax adapters that emit the same fact shape.

Phase 2 uses the TypeScript compiler API for semantic facts:

- resolved definitions
- references
- resolved call targets
- inferred owner types for field reads and writes
- union / enum values for state candidates

Other languages should add semantic adapters behind the same interface instead of changing the `.gagcode` artifact format.

## Retrieval

`gagcode scan` builds three local indexes:

- structured index: exact lookup by file, symbol, field, type, entry kind, and fact id
- graph index: local relationship graph across files, facts, calls, references, imports, and field access
- vector index: local TF-IDF style sparse vectors for fuzzy evidence search without external embeddings

Use query mode for Agent or CLI inspection:

```bash
gagcode query "status transition" --limit 10
```

Query mode defaults to 10 results to keep outputs small enough for agent context. Increase or decrease it with `--limit`. Query output omits internal vector weights and returns only evidence fields.

Agents should use query results as navigation hints, then read the corresponding source code snippets. Source code is the behavioral ground truth; facts and indexes are not meant to be loaded wholesale into the model context.
