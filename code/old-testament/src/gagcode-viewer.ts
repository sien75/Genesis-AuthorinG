import http from "node:http";
import { queryGraphIndex, queryStructuredIndex, queryVectorIndex } from "./gagcode-index.js";
import type { GagcodeGraphIndex, GagcodeModel, GagcodeStructuredIndex, GagcodeVectorIndex } from "./gagcode-types.js";

export interface GagcodeViewerIndexes {
  structured: GagcodeStructuredIndex;
  graph: GagcodeGraphIndex;
  vector: GagcodeVectorIndex;
}

export function renderGagcodeHtml(model: GagcodeModel): string {
  const languages = Object.entries(model.summary.languageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => `<li><span>${escapeHtml(language)}</span><strong>${count}</strong></li>`)
    .join("");

  const entries = model.facts.entries
    .slice(0, 50)
    .map(
      (entry) => `<tr><td>${escapeHtml(entry.kind)}</td><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(
        `${entry.file}:${entry.line}`
      )}</td><td>${escapeHtml(entry.confidence)}</td></tr>`
    )
    .join("");

  const symbols = model.facts.symbols
    .slice(0, 80)
    .map(
      (symbol) => `<tr><td>${escapeHtml(symbol.kind)}</td><td>${escapeHtml(symbol.name)}</td><td>${escapeHtml(
        `${symbol.file}:${symbol.line}`
      )}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>gagcode</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #172026; background: #f7f5ef; }
    header { padding: 28px 32px 18px; background: #1f2933; color: #f8fafc; }
    main { padding: 24px 32px 40px; max-width: 1180px; margin: 0 auto; }
    h1, h2 { margin: 0; font-weight: 720; letter-spacing: 0; }
    h1 { font-size: 28px; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .meta { margin-top: 8px; color: #cbd5e1; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .panel { background: #fff; border: 1px solid #d9dee5; border-radius: 8px; padding: 16px; }
    .metric { font-size: 26px; font-weight: 760; margin-top: 8px; }
    .label { font-size: 13px; color: #667085; }
    .content { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
    .search { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 0 0 16px; }
    input { border: 1px solid #c8d0da; border-radius: 6px; padding: 10px 12px; font: inherit; min-width: 0; }
    button { border: 0; border-radius: 6px; background: #2563eb; color: white; padding: 10px 14px; font: inherit; font-weight: 650; cursor: pointer; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #101820; color: #eef4ff; border-radius: 8px; padding: 12px; max-height: 420px; overflow: auto; font-size: 12px; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    li { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #edf0f3; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #edf0f3; vertical-align: top; }
    th { color: #475467; font-weight: 650; }
    @media (max-width: 860px) {
      header, main { padding-left: 18px; padding-right: 18px; }
      .grid, .content { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>gagcode</h1>
    <div class="meta">${escapeHtml(model.summary.root)} · generated ${escapeHtml(model.generatedAt)}</div>
  </header>
  <main>
    <section class="panel">
      <h2>Evidence Search</h2>
      <form class="search" id="search-form">
        <input id="search-input" name="q" placeholder="Search fields, symbols, calls, files, or concepts" autocomplete="off" />
        <button type="submit">Search</button>
      </form>
      <pre id="search-output">Search combines structured index, local vector index, and graph neighborhood.</pre>
    </section>
    <section class="grid" aria-label="Summary">
      <div class="panel"><div class="label">Files</div><div class="metric">${model.summary.fileCount}</div></div>
      <div class="panel"><div class="label">Entries</div><div class="metric">${model.summary.entryCount}</div></div>
      <div class="panel"><div class="label">Symbols</div><div class="metric">${model.summary.symbolCount}</div></div>
      <div class="panel"><div class="label">Calls</div><div class="metric">${model.summary.callCount}</div></div>
      <div class="panel"><div class="label">Imports</div><div class="metric">${model.summary.importCount}</div></div>
      <div class="panel"><div class="label">Field Reads</div><div class="metric">${model.summary.fieldReadCount}</div></div>
      <div class="panel"><div class="label">Definitions</div><div class="metric">${model.summary.definitionCount}</div></div>
      <div class="panel"><div class="label">Semantic Claims</div><div class="metric">${semanticCount(model)}</div></div>
    </section>
    <section class="content">
      <aside class="panel">
        <h2>Languages</h2>
        <ul>${languages}</ul>
      </aside>
      <div class="panel">
        <h2>Entries</h2>
        <table><thead><tr><th>Kind</th><th>Name</th><th>Evidence</th><th>Confidence</th></tr></thead><tbody>${entries}</tbody></table>
      </div>
      <div></div>
      <div class="panel">
        <h2>Symbols</h2>
        <table><thead><tr><th>Kind</th><th>Name</th><th>Evidence</th></tr></thead><tbody>${symbols}</tbody></table>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById("search-form");
    const input = document.getElementById("search-input");
    const output = document.getElementById("search-output");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      output.textContent = "Searching...";
      const response = await fetch("/query?q=" + encodeURIComponent(q));
      output.textContent = JSON.stringify(await response.json(), null, 2);
    });
  </script>
</body>
</html>`;
}

export async function serveGagcodeHtml(model: GagcodeModel, indexes: GagcodeViewerIndexes, port: number): Promise<void> {
  const html = renderGagcodeHtml(model);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/gagcode.model.json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(model, null, 2));
      return;
    }
    if (url.pathname === "/query") {
      const query = url.searchParams.get("q") ?? "";
      const result = {
        query,
        structured: queryStructuredIndex(indexes.structured, query, 10),
        vector: queryVectorIndex(indexes.vector, query, 10),
        graph: queryGraphIndex(indexes.graph, query, 2, 10)
      };
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(result, null, 2));
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  console.log(`gagcode viewer: http://127.0.0.1:${port}`);
}

function semanticCount(model: GagcodeModel): number {
  return Object.values(model.semantic).reduce((sum, value) => sum + value.length, 0);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
