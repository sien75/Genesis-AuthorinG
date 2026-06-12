---
name: gagcode-viewer
description: |
  Generate a local browser viewer for gagcode semantic artifacts. Creates HTML/JS pages in .gagcode/views/ that visualize capabilities, flows, and states. Only generates once — if views already exist, reuse them or modify per user request. Use when user asks to view, render, visualize, or browse gagcode analysis results.
---

# gagcode-viewer

Generate a minimal browser-based viewer for `.gagcode/semantic/` artifacts.

## When to Use

- User asks to "view", "render", "visualize", or "see" the gagcode analysis
- User says "start the viewer" or "show me the capabilities"
- User wants to modify or improve an existing viewer page

## Prerequisites

- `.gagcode/semantic/gagcode.capabilities.json` must exist and be non-empty
- If semantic artifacts don't exist, tell the user to run the `gagcode-analyzer` skill first

## Workflow

### If `.gagcode/views/` does not exist or is empty:

1. Create `.gagcode/views/` directory
2. Generate the viewer files (see Generation Guide below)
3. Start the server: `npx serve .gagcode/views`

### If `.gagcode/views/` already has files:

1. Start the server directly: `npx serve .gagcode/views`
2. If user requests UI changes, modify the existing files

## Generation Guide

Generate a single-page app that reads JSON files from the same directory. Before generating, copy the semantic JSON files into `.gagcode/views/` so the static server can serve them:

```bash
cp .gagcode/semantic/gagcode.capabilities.json .gagcode/views/capabilities.json
cp .gagcode/semantic/gagcode.flows.json .gagcode/views/flows.json
cp .gagcode/semantic/gagcode.states.json .gagcode/views/states.json
```

### File Structure

```
.gagcode/views/
  index.html        — main page, loads app.js
  app.js            — fetch JSON, render UI
  style.css         — minimal styling
  capabilities.json — copied from semantic/
  flows.json        — copied from semantic/
  states.json       — copied from semantic/
```

### Page Layout

The viewer has a simple 3-level drill-down structure:

```
┌─────────────────────────────────────────────┐
│  Project Name        [Capabilities] [States]│
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ Cap1 │  │ Cap2 │  │ Cap3 │  │ Cap4 │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ Cap5 │  │ Cap6 │  │ Cap7 │             │
│  └──────┘  └──────┘  └──────┘             │
│                                             │
└─────────────────────────────────────────────┘
```

**Level 1 — Capability Map (default view):**
- Show all capabilities as cards in a grid
- Each card shows: name, summary, category badge, confidence indicator
- Group by category (auth, data, user, system, integration, admin)
- Click a card → drill into its flow

**Level 2 — Flow View:**
- Show the flow as a vertical step list (top to bottom)
- Each step shows: node type icon/color, label, evidence link
- Edges shown as arrows between steps
- Decision nodes branch into multiple paths
- Side panel shows: inputs, outputs, side effects
- Back button → return to capability map

**Level 3 — Node Detail (optional panel):**
- Click a flow node → show detail panel on the right
- Shows: related states, conditions, branch behavior, and evidence files
- Evidence items are displayed as `file:line` text

### Navigation Tabs

Top nav has tabs for global views:
- **Capabilities** (default) — the card grid
- **States** — list all state machines with their transitions

### Design Principles

- Clean, minimal, no framework (vanilla HTML/JS/CSS)
- Light background, readable fonts (system font stack)
- Category colors: auth=orange, data=green, user=blue, system=gray, integration=cyan, admin=purple
- Confidence shown as a small dot: high=green, medium=yellow, low=red
- Responsive — works on laptop screens (no mobile needed)
- No build step — plain files served directly

### Data Loading

```javascript
// app.js pattern
async function loadData() {
  const [capabilities, flows, states] = await Promise.all([
    fetch('capabilities.json').then(r => r.json()),
    fetch('flows.json').then(r => r.json()),
    fetch('states.json').then(r => r.json()),
  ]);
  return { capabilities, flows, states };
}
```

### Flow Rendering

For the flow view, render nodes as a vertical list with connecting lines. Use CSS for layout, not canvas or SVG (keep it simple):

```
  ● Entry
  │
  ◆ Decision: check response code
  ├── ● Transform: find next task (code=1000)
  │   │
  │   ● StateChange: update stack
  │   │
  │   ● Response: navigate to route
  │
  └── ● ExternalCall: cancel RPC (error)
      │
      ● Error: exit with failure
```

Node type → icon mapping:
- Entry: ● blue
- Input: ○ gray
- Validation: ✓ yellow
- Permission: 🔒 orange
- Transform: ⟳ purple
- Decision: ◆ yellow (shows branches)
- StateChange: ⊕ red
- Persist: ▪ green
- ExternalCall: ↗ cyan
- Event: ⚡ pink
- Queue: ☰ indigo
- Response: ● blue
- Error: ✕ red

### Updating Views

When the user asks to change the UI:
1. Read the existing files in `.gagcode/views/`
2. Make the requested modifications
3. Tell the user to refresh the browser

When semantic data changes (user re-runs analyzer):
1. Re-copy the JSON files: `cp .gagcode/semantic/gagcode.*.json .gagcode/views/` (strip the gagcode. prefix)
2. Tell the user to refresh

## Rules

- Do not use any npm packages, frameworks, or build tools for the viewer
- Keep total file size under 50KB (HTML + JS + CSS combined)
- The viewer must work offline after initial load (no CDN dependencies)
- Do not modify files outside `.gagcode/views/`
- If semantic data is missing or empty, show a helpful message instead of crashing
