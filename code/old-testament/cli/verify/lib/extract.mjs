/**
 * Extract mermaid blocks and sourceMap from an HTML content file.
 */

export function extractMermaidBlocks(html) {
  const blocks = [];
  const re = /<pre\s+class="mermaid">([\s\S]*?)<\/pre>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export function extractSourceMap(html) {
  const re = /window\.__sourceMap\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/;
  const match = html.match(re);
  if (!match) return { raw: null, parsed: null, error: null };

  try {
    const parsed = JSON.parse(match[1]);
    return { raw: match[1], parsed, error: null };
  } catch (e) {
    return { raw: match[1], parsed: null, error: e.message };
  }
}
