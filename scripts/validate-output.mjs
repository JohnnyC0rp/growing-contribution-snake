import { readFile, stat } from "node:fs/promises";

const outputFiles = [
  new URL("../dist/github-contribution-grid-snake.svg", import.meta.url),
  new URL("../dist/github-activity-graph.svg", import.meta.url),
];

for (const outputFile of outputFiles) {
  const fileStats = await stat(outputFile);
  const svg = await readFile(outputFile, "utf8");

  if (fileStats.size > 250_000) {
    throw new Error(`${outputFile.pathname} exceeds the 250 KB size limit`);
  }
  if (!svg.startsWith('<?xml version="1.0"') || !svg.includes("<svg")) {
    throw new Error(`${outputFile.pathname} is not a complete SVG document`);
  }
  if (/Bearer|GITHUB_TOKEN|gh[opsu]_[A-Za-z0-9_]+/.test(svg)) {
    throw new Error(`${outputFile.pathname} contains credential-like text`);
  }
}

console.log("Validated both generated SVG files.");
