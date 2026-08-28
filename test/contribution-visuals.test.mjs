import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE_SNAKE_LENGTH,
  buildSerpentineRoute,
  buildSnakeFrames,
  normalizeContributionCalendar,
  renderActivityGraph,
  renderContributionSnake,
} from "../src/contribution-visuals.mjs";

test("normalizes GitHub weeks into a complete seven-row grid", () => {
  const grid = normalizeContributionCalendar([
    {
      contributionDays: [
        {
          contributionCount: 2,
          contributionLevel: "SECOND_QUARTILE",
          date: "2026-08-23",
          weekday: 0,
        },
      ],
    },
  ]);

  assert.equal(grid.width, 1);
  assert.equal(grid.cells.length, 7);
  assert.deepEqual(grid.cells[0], {
    x: 0,
    y: 0,
    date: "2026-08-23",
    count: 2,
    level: 2,
  });
  assert.equal(grid.cells[6].count, 0);
});

test("builds one continuous route that visits every graph cell exactly once", () => {
  const width = 4;
  const height = 3;
  const route = buildSerpentineRoute(width, height);
  const graphRoute = route.slice(BASE_SNAKE_LENGTH);
  const uniqueCells = new Set(graphRoute.map(({ x, y }) => `${x}:${y}`));

  assert.equal(graphRoute.length, width * height);
  assert.equal(uniqueCells.size, width * height);

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const distance =
      Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
    assert.equal(distance, 1);
  }
});

test("grows by exactly one segment for every eaten active day", () => {
  const grid = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, count: 8, level: 4 },
      { x: 0, y: 1, count: 0, level: 0 },
      { x: 1, y: 0, count: 3, level: 2 },
      { x: 1, y: 1, count: 0, level: 0 },
    ],
  };
  const frames = buildSnakeFrames(
    grid,
    buildSerpentineRoute(grid.width, grid.height),
  );

  assert.equal(frames[0].snakeLength, BASE_SNAKE_LENGTH);
  assert.equal(frames[1].snakeLength, BASE_SNAKE_LENGTH + 1);
  assert.equal(frames.at(-1).snakeLength, BASE_SNAKE_LENGTH + 2);
  assert.ok(frames.every((frame) => frame.tailDistance >= 0));
});

test("renders a looping accessible SVG without embedding credentials", () => {
  const grid = {
    width: 1,
    height: 1,
    cells: [
      {
        x: 0,
        y: 0,
        date: "2026-08-28",
        count: 1,
        level: 1,
      },
    ],
  };
  const svg = renderContributionSnake(grid, "JohnnyC0rp");

  assert.match(svg, /^<\?xml/);
  assert.match(svg, /repeatCount="indefinite"/);
  assert.match(svg, /grows by one segment for every active day/);
  assert.doesNotMatch(svg, /Bearer|GITHUB_TOKEN|gho_/);
});

test("renders the latest 30 contribution days as a self-contained activity graph", () => {
  const cells = Array.from({ length: 35 }, (_, index) => ({
    x: Math.floor(index / 7),
    y: index % 7,
    date: new Date(Date.UTC(2026, 6, 25 + index)).toISOString().slice(0, 10),
    count: index === 34 ? 7 : 0,
    level: index === 34 ? 4 : 0,
  }));
  const svg = renderActivityGraph({ width: 5, height: 7, cells }, "JohnnyC0rp");

  assert.match(svg, /JohnnyC0rp's Contribution Graph/);
  assert.match(svg, /2026-08-28: 7 contributions/);
  assert.doesNotMatch(svg, /2026-07-25: 0 contributions/);
  assert.doesNotMatch(svg, /Bearer|GITHUB_TOKEN|gho_/);
});

test("makes a real zero-activity period explicit instead of looking broken", () => {
  const grid = {
    width: 1,
    height: 2,
    cells: [
      { x: 0, y: 0, date: "2026-08-27", count: 0, level: 0 },
      { x: 0, y: 1, date: "2026-08-28", count: 0, level: 0 },
    ],
  };

  assert.match(
    renderActivityGraph(grid, "JohnnyC0rp", 2),
    /No contributions in the last 2 days/,
  );
});
