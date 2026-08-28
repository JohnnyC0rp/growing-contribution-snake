import { readFile, stat } from "node:fs/promises";

const outputFile = new URL(
  "../dist/github-contribution-grid-snake.svg",
  import.meta.url,
);
const forbiddenContent = [
  [/<\s*(?:[A-Za-z_][\w.-]*:)?script\b/i, "script elements"],
  [/<\s*(?:[A-Za-z_][\w.-]*:)?foreignObject\b/i, "foreignObject elements"],
  [
    /<\s*(?:[A-Za-z_][\w.-]*:)?(?:iframe|object|embed|image|use|a)\b/i,
    "external-resource or navigation elements",
  ],
  [
    /\s(?:[A-Za-z_][\w.-]*:)?(?:href|src)\s*=/i,
    "external-resource attributes",
  ],
  [/(?:url\s*\(|@import\b)/i, "CSS external-resource references"],
  [
    /\s(?:[A-Za-z_][\w.-]*:)?on[a-z][\w.-]*\s*=/i,
    "event-handler attributes",
  ],
  [/(?:javascript|vbscript)\s*:/i, "scriptable URL schemes"],
  [/<\s*!(?:DOCTYPE|ENTITY)\b/i, "document type or entity declarations"],
];

const fileStats = await stat(outputFile);
const svg = await readFile(outputFile, "utf8");

if (fileStats.size > 250_000) {
  throw new Error(`${outputFile.pathname} exceeds the 250 KB size limit`);
}
if (!svg.startsWith('<?xml version="1.0"') || !svg.includes("<svg")) {
  throw new Error(`${outputFile.pathname} is not a complete SVG document`);
}
if (
  /Bearer|GITHUB_TOKEN|gh[opsu]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/.test(
    svg,
  )
) {
  throw new Error(`${outputFile.pathname} contains credential-like text`);
}
for (const [pattern, description] of forbiddenContent) {
  if (pattern.test(svg)) {
    throw new Error(`${outputFile.pathname} contains ${description}`);
  }
}

console.log("Validated generated snake SVG.");
