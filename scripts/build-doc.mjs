/**
 * Render docs/LearnPath-Technical-Doc.md into a polished, print-ready HTML file.
 * Open the HTML and Ctrl/Cmd+P → "Save as PDF" for a clean PDF.
 *
 *   node scripts/build-doc.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "..", "docs");
const mdPath = join(docsDir, "LearnPath-Technical-Doc.md");
const outPath = join(docsDir, "LearnPath-Technical-Doc.html");

const md = readFileSync(mdPath, "utf8");
const body = marked.parse(md, { gfm: true, breaks: false });

const css = `
:root { --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --accent:#0f172a; --code:#f1f5f9; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--ink); line-height: 1.55; font-size: 11.5pt;
  max-width: 820px; margin: 0 auto; padding: 48px 40px;
}
h1 { font-size: 26pt; letter-spacing: -0.02em; margin: 0 0 6px; }
h2 { font-size: 16pt; letter-spacing: -0.01em; margin: 32px 0 10px; padding-bottom: 6px; border-bottom: 2px solid var(--line); }
h3 { font-size: 12.5pt; margin: 22px 0 6px; }
h4 { font-size: 11.5pt; margin: 16px 0 4px; color: var(--muted); }
p, li { color: var(--ink); }
a { color: #1d4ed8; text-decoration: none; }
strong { color: var(--ink); }
hr { border: none; border-top: 1px solid var(--line); margin: 28px 0; }
blockquote {
  margin: 14px 0; padding: 10px 16px; border-left: 3px solid var(--accent);
  background: #f8fafc; color: var(--muted); border-radius: 0 8px 8px 0;
}
blockquote p { margin: 4px 0; }
code { font-family: "SF Mono", "Cascadia Code", Consolas, monospace; font-size: 9.8pt;
  background: var(--code); padding: 1.5px 5px; border-radius: 4px; }
pre { background: var(--code); padding: 14px 16px; border-radius: 10px; overflow-x: auto;
  border: 1px solid var(--line); page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 9.2pt; line-height: 1.45; }
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 9.8pt; page-break-inside: avoid; }
th, td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
th { background: #f1f5f9; font-weight: 600; }
tr:nth-child(even) td { background: #fafbfc; }
ul, ol { padding-left: 22px; }
li { margin: 3px 0; }
h1, h2, h3, h4 { page-break-after: avoid; }
@page { size: A4; margin: 16mm; }
@media print { body { padding: 0; max-width: none; } a { color: var(--ink); } }
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>LearnPath — Technical & Design Document</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log("✓ wrote", outPath);
