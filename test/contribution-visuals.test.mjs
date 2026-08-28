import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE_SNAKE_LENGTH,
  CELL_SIZE,
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

test("builds a Hamiltonian route with smooth outward entry and exit", () => {
  const width = 53;
  const height = 7;
  const exitSteps = 8;
  const route = buildRandomizedRoute(
    width,
    height,
    createRouteSeed("JohnnyC0rp", "2026-08-28"),
    exitSteps,
  );
  const graphRoute = route.slice(
    BASE_SNAKE_LENGTH,
    BASE_SNAKE_LENGTH + width * height,
  );
  const entry = route.slice(0, BASE_SNAKE_LENGTH);
  const exit = route.slice(BASE_SNAKE_LENGTH + width * height);
  const uniqueCells = new Set(graphRoute.map(({ x, y }) => `${x}:${y}`));

  assert.equal(graphRoute.length, width * height);
  assert.equal(uniqueCells.size, width * height);
  assert.equal(exit.length, exitSteps);

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const distance =
      Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
    assert.equal(distance, 1);
  }

  const entryDirection = direction(entry[0], entry[1]);
  assert.deepEqual(direction(entry[1], entry[2]), entryDirection);
  assert.deepEqual(direction(entry[2], graphRoute[0]), entryDirection);
  assert.deepEqual(direction(graphRoute[0], graphRoute[1]), entryDirection);
  assert.ok(entry.every((point) => isOutside(point, width, height)));

  const exitDirection = direction(graphRoute.at(-2), graphRoute.at(-1));
  assert.deepEqual(direction(graphRoute.at(-1), exit[0]), exitDirection);
  for (let index = 1; index < exit.length; index += 1) {
    assert.deepEqual(direction(exit[index - 1], exit[index]), exitDirection);
  }
  assert.ok(exit.every((point) => isOutside(point, width, height)));
});

test("builds valid routes for odd, transposed, even, and single-cell grids", () => {
  for (const [width, height] of [
    [5, 4],
    [4, 5],
    [4, 4],
    [1, 4],
    [4, 1],
    [1, 1],
  ]) {
    const route = buildRandomizedRoute(width, height, 42);
    const graphRoute = route.slice(
      BASE_SNAKE_LENGTH,
      BASE_SNAKE_LENGTH + width * height,
    );
    const uniqueCells = new Set(graphRoute.map(({ x, y }) => `${x}:${y}`));

    assert.equal(graphRoute.length, width * height);
    assert.equal(uniqueCells.size, width * height);
    assert.ok(
      graphRoute.every(
        ({ x, y }) => x >= 0 && x < width && y >= 0 && y < height,
      ),
    );
    assertRouteIsAdjacent(route);
  }
});

test("selects a lively but controlled opening for the current profile seed", () => {
  const width = 53;
  const height = 7;
  const route = buildRandomizedRoute(
    width,
    height,
    createRouteSeed("JohnnyC0rp", "2026-08-28"),
  );
  const graphRoute = route.slice(
    BASE_SNAKE_LENGTH,
    BASE_SNAKE_LENGTH + width * height,
  );
  const opening = measureOpening(graphRoute);

  assert.ok(opening.turns >= 8 && opening.turns <= 18);
  assert.ok(opening.firstTurn <= 5);
  assert.ok(opening.maxStraightRun <= 5);
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
  const activeDayCount = grid.cells.filter((cell) => cell.count > 0).length;
  const exitClearanceSteps = BASE_SNAKE_LENGTH + 1;
  const route = buildRandomizedRoute(
    grid.width,
    grid.height,
    createRouteSeed("test", "2026-08-28"),
    BASE_SNAKE_LENGTH + activeDayCount + exitClearanceSteps,
  );
  const frames = buildSnakeFrames(grid, route);

  assert.equal(frames[0].snakeLength, BASE_SNAKE_LENGTH);
  assert.equal(frames[1].snakeLength, BASE_SNAKE_LENGTH + 1);
  assert.equal(frames.at(-1).snakeLength, BASE_SNAKE_LENGTH + 2);
  assert.ok(frames.every((frame) => frame.tailDistance >= 0));
  const lastGridCellDistance =
    (BASE_SNAKE_LENGTH + grid.width * grid.height - 1) * CELL_SIZE;
  assert.equal(
    frames.at(-1).tailDistance,
    lastGridCellDistance + (exitClearanceSteps + 1) * CELL_SIZE,
  );
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

function direction(from, to) {
  return { x: to.x - from.x, y: to.y - from.y };
}

function isOutside(point, width, height) {
  return point.x < 0 || point.x >= width || point.y < 0 || point.y >= height;
}

function assertRouteIsAdjacent(route) {
  for (let index = 1; index < route.length; index += 1) {
    const distance =
      Math.abs(route[index].x - route[index - 1].x) +
      Math.abs(route[index].y - route[index - 1].y);
    assert.equal(distance, 1);
  }
}

function measureOpening(route) {
  const opening = route.slice(0, 30);
  let previousDirection = direction(opening[0], opening[1]);
  let turns = 0;
  let firstTurn = Number.POSITIVE_INFINITY;
  let straightRun = 1;
  let maxStraightRun = 1;

  for (let index = 2; index < opening.length; index += 1) {
    const nextDirection = direction(opening[index - 1], opening[index]);
    if (
      nextDirection.x === previousDirection.x &&
      nextDirection.y === previousDirection.y
    ) {
      straightRun += 1;
      maxStraightRun = Math.max(maxStraightRun, straightRun);
      continue;
    }

    turns += 1;
    firstTurn = Math.min(firstTurn, index);
    straightRun = 1;
    previousDirection = nextDirection;
  }

  return { turns, firstTurn, maxStraightRun };
}
