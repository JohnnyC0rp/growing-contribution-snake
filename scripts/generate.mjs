import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  fetchContributionCalendar,
  renderContributionSnake,
} from "../src/contribution-visuals.mjs";

const USERNAME =
  process.env.PROFILE_USERNAME?.trim() ||
  process.env.GITHUB_REPOSITORY_OWNER?.trim() ||
  "JohnnyC0rp";
const outputUrl = new URL(
  "../dist/github-contribution-grid-snake.svg",
  import.meta.url,
);

const grid = await fetchContributionCalendar(USERNAME, process.env.GITHUB_TOKEN);
const svg = renderContributionSnake(grid, USERNAME);
const outputPath = fileURLToPath(outputUrl);

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(
  `Generated ${outputPath} from ${grid.cells.filter((cell) => cell.count > 0).length} active contribution days.`,
);
