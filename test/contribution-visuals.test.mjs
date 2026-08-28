import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE_SNAKE_LENGTH,
  buildRandomizedRoute,
  buildSnakeFrames,
  createRouteSeed,
  normalizeContributionCalendar,
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

test("builds a clean-entry Hamiltonian route over the full GitHub grid", () => {
  const width = 53;
  const height = 7;
  const route = buildRandomizedRoute(
    width,
    height,
    createRouteSeed("JohnnyC0rp", "2026-08-28"),
  );
  const graphRoute = route.slice(BASE_SNAKE_LENGTH);
  const uniqueCells = new Set(graphRoute.map(({ x, y }) => `${x}:${y}`));

  assert.deepEqual(route.slice(0, BASE_SNAKE_LENGTH), [
    { x: -3, y: 0 },
    { x: -2, y: 0 },
    { x: -1, y: 0 },
  ]);
  assert.deepEqual(graphRoute[0], { x: 0, y: 0 });
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

test("reproduces a route for the same seed and diverges for another seed", () => {
  const firstSeed = createRouteSeed("JohnnyC0rp", "2026-08-28");
  const secondSeed = createRouteSeed("JohnnyC0rp", "2026-08-29");
  const firstRoute = buildRandomizedRoute(53, 7, firstSeed);

  assert.equal(firstSeed, createRouteSeed("JohnnyC0rp", "2026-08-28"));
  assert.notEqual(firstSeed, secondSeed);
  assert.deepEqual(firstRoute, buildRandomizedRoute(53, 7, firstSeed));
  assert.notDeepEqual(firstRoute, buildRandomizedRoute(53, 7, secondSeed));
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
    buildRandomizedRoute(
      grid.width,
      grid.height,
      createRouteSeed("test", "2026-08-28"),
    ),
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
