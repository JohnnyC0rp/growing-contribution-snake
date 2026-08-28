const CONTRIBUTION_LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export const BASE_SNAKE_LENGTH = 3;
export const CELL_SIZE = 15;

const DOT_SIZE = 11;
const PADDING = 8;
const STEP_DURATION_MS = 45;
const END_PAUSE_MS = 1_800;
const BACKBITE_STEPS_PER_CELL = 32;
const EXIT_CLEARANCE_STEPS = BASE_SNAKE_LENGTH + 1;
const CARDINAL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function normalizeContributionCalendar(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    throw new Error("GitHub returned an empty contribution calendar");
  }

  const width = weeks.length;
  const height = 7;
  const populatedCells = new Map();

  weeks.forEach((week, x) => {
    for (const day of week.contributionDays ?? []) {
      const y = Number.isInteger(day.weekday)
        ? day.weekday
        : new Date(`${day.date}T00:00:00Z`).getUTCDay();

      populatedCells.set(`${x}:${y}`, {
        x,
        y,
        date: day.date,
        count: day.contributionCount,
        level: CONTRIBUTION_LEVELS[day.contributionLevel] ?? 0,
      });
    }
  });

  const cells = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      cells.push(
        populatedCells.get(`${x}:${y}`) ?? {
          x,
          y,
          date: null,
          count: 0,
          level: 0,
        },
      );
    }
  }

  return { width, height, cells };
}

export function createRouteSeed(username, latestCalendarDate) {
  let hash = 2_166_136_261;
  const input = `${username}:${latestCalendarDate}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function buildRandomizedRoute(
  width,
  height,
  seed,
  exitSteps = BASE_SNAKE_LENGTH + EXIT_CLEARANCE_STEPS,
) {
  let graphRoute = buildHamiltonianBackbone(width, height);
  const fallbackRoute = graphRoute;
  const random = createSeededRandom(seed);
  const shuffleSteps = graphRoute.length * BACKBITE_STEPS_PER_CELL;
  let bestRoute = selectRouteCandidate(null, graphRoute, width, height);

  for (let step = 0; step < shuffleSteps; step += 1) {
    graphRoute = applyBackbite(graphRoute, width, height, random);
    bestRoute = selectRouteCandidate(bestRoute, graphRoute, width, height);
    bestRoute = selectRouteCandidate(
      bestRoute,
      graphRoute.toReversed(),
      width,
      height,
    );
  }

  graphRoute = bestRoute?.route ?? fallbackRoute;
  const startDirection = getDirection(graphRoute[0], graphRoute[1]) ?? {
    x: 1,
    y: 0,
  };
  const endDirection =
    getDirection(graphRoute.at(-2), graphRoute.at(-1)) ?? startDirection;
  const entry = Array.from({ length: BASE_SNAKE_LENGTH }, (_, index) => ({
    x: graphRoute[0].x - startDirection.x * (BASE_SNAKE_LENGTH - index),
    y: graphRoute[0].y - startDirection.y * (BASE_SNAKE_LENGTH - index),
  }));
  const exit = Array.from({ length: exitSteps }, (_, index) => ({
    x: graphRoute.at(-1).x + endDirection.x * (index + 1),
    y: graphRoute.at(-1).y + endDirection.y * (index + 1),
  }));

  return [...entry, ...graphRoute, ...exit];
}

function buildHamiltonianBackbone(width, height) {
  if (width % 2 === 1) return buildPairedRowBackbone(width, height);

  if (height % 2 === 1) {
    return buildPairedRowBackbone(height, width).map(({ x, y }) => ({
      x: y,
      y: x,
    }));
  }

  const graphRoute = [];
  for (let x = 0; x < width; x += 1) {
    if (x % 2 === 0) {
      for (let y = 0; y < height; y += 1) graphRoute.push({ x, y });
    } else {
      for (let y = height - 1; y >= 0; y -= 1) graphRoute.push({ x, y });
    }
  }

  return graphRoute;
}

function buildPairedRowBackbone(width, height) {
  const graphRoute = [];

  for (let x = 0; x < width; x += 1) graphRoute.push({ x, y: 0 });

  for (let x = width - 1; x >= 0; x -= 1) {
    const descending = (width - 1 - x) % 2 === 0;
    if (descending) {
      for (let y = 1; y < height; y += 1) graphRoute.push({ x, y });
    } else {
      for (let y = height - 1; y >= 1; y -= 1) graphRoute.push({ x, y });
    }
  }

  return graphRoute;
}

function applyBackbite(route, width, height, random) {
  const mutateHead = random() < 0.5;
  const endpoint = mutateHead ? route[0] : route.at(-1);
  const existingNeighbor = mutateHead ? route[1] : route.at(-2);
  const candidates = CARDINAL_DIRECTIONS.map(({ x, y }) => ({
    x: endpoint.x + x,
    y: endpoint.y + y,
  })).filter(
    (point) =>
      point.x >= 0 &&
      point.x < width &&
      point.y >= 0 &&
      point.y < height &&
      (point.x !== existingNeighbor?.x || point.y !== existingNeighbor?.y),
  );

  if (candidates.length === 0) return route;

  const bite = candidates[Math.floor(random() * candidates.length)];
  const biteIndex = route.findIndex(
    (point) => point.x === bite.x && point.y === bite.y,
  );

  if (mutateHead) {
    return [
      ...route.slice(0, biteIndex).reverse(),
      ...route.slice(biteIndex),
    ];
  }

  return [
    ...route.slice(0, biteIndex + 1),
    ...route.slice(biteIndex + 1).reverse(),
  ];
}

function selectRouteCandidate(best, route, width, height) {
  if (!hasOutwardTangents(route, width, height)) return best;

  const opening = measureOpening(route);
  if (
    route.length >= 30 &&
    (opening.turns < 8 ||
      opening.turns > 18 ||
      opening.firstTurn > 5 ||
      opening.maxStraightRun > 5)
  ) {
    return best;
  }

  const candidate = {
    route,
    score: [
      Math.abs(opening.turns - 12),
      opening.maxStraightRun,
      -manhattanDistance(route[0], route.at(-1)),
    ],
  };

  if (!best || compareScores(candidate.score, best.score) < 0) {
    return candidate;
  }

  return best;
}

function hasOutwardTangents(route, width, height) {
  if (route.length === 1) return true;

  const startDirection = getDirection(route[0], route[1]);
  const endDirection = getDirection(route.at(-2), route.at(-1));
  const beforeStart = {
    x: route[0].x - startDirection.x,
    y: route[0].y - startDirection.y,
  };
  const afterEnd = {
    x: route.at(-1).x + endDirection.x,
    y: route.at(-1).y + endDirection.y,
  };

  return (
    isOutside(beforeStart, width, height) &&
    isOutside(afterEnd, width, height)
  );
}

function measureOpening(route) {
  const opening = route.slice(0, 30);
  if (opening.length < 2) {
    return { turns: 0, firstTurn: Number.POSITIVE_INFINITY, maxStraightRun: 0 };
  }

  let previousDirection = getDirection(opening[0], opening[1]);
  let straightRun = 1;
  let maxStraightRun = 1;
  let turns = 0;
  let firstTurn = Number.POSITIVE_INFINITY;

  for (let index = 2; index < opening.length; index += 1) {
    const direction = getDirection(opening[index - 1], opening[index]);
    if (
      direction.x === previousDirection.x &&
      direction.y === previousDirection.y
    ) {
      straightRun += 1;
      maxStraightRun = Math.max(maxStraightRun, straightRun);
      continue;
    }

    turns += 1;
    firstTurn = Math.min(firstTurn, index);
    straightRun = 1;
    previousDirection = direction;
  }

  return { turns, firstTurn, maxStraightRun };
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }

  return 0;
}

function getDirection(from, to) {
  if (!from || !to) return null;
  return { x: to.x - from.x, y: to.y - from.y };
}

function manhattanDistance(first, second) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function isOutside(point, width, height) {
  return point.x < 0 || point.x >= width || point.y < 0 || point.y >= height;
}

export function buildSnakeFrames(grid, route) {
  const activeCells = new Set(
    grid.cells
      .filter((cell) => cell.count > 0)
      .map((cell) => `${cell.x}:${cell.y}`),
  );
  const frames = [];
  let snakeLength = BASE_SNAKE_LENGTH;

  for (
    let headIndex = BASE_SNAKE_LENGTH - 1;
    headIndex < route.length;
    headIndex += 1
  ) {
    const head = route[headIndex];
    if (activeCells.has(`${head.x}:${head.y}`)) snakeLength += 1;

    const headDistance = headIndex * CELL_SIZE;
    const bodyDistance = (snakeLength - 1) * CELL_SIZE;

    frames.push({
      head,
      headIndex,
      snakeLength,
      headDistance,
      bodyDistance,
      tailDistance: headDistance - bodyDistance,
    });
  }

  return frames;
}

export function renderContributionSnake(grid, username) {
  const latestCalendarDate = grid.cells.reduce(
    (latest, cell) => (cell.date && cell.date > latest ? cell.date : latest),
    "",
  );
  const activeDayCount = grid.cells.filter((cell) => cell.count > 0).length;
  const route = buildRandomizedRoute(
    grid.width,
    grid.height,
    createRouteSeed(username, latestCalendarDate),
    BASE_SNAKE_LENGTH + activeDayCount + EXIT_CLEARANCE_STEPS,
  );
  const frames = buildSnakeFrames(grid, route);
  const routeIndexes = new Map(
    route.map((point, index) => [`${point.x}:${point.y}`, index]),
  );
  const originX = PADDING + BASE_SNAKE_LENGTH * CELL_SIZE;
  const originY = PADDING;
  const width = originX + grid.width * CELL_SIZE + PADDING;
  const height = originY + grid.height * CELL_SIZE + PADDING;
  const totalPathLength = (route.length - 1) * CELL_SIZE;
  const movementDuration = (frames.length - 1) * STEP_DURATION_MS;
  const totalDuration = movementDuration + END_PAUSE_MS;
  const movementFraction = movementDuration / totalDuration;

  const toSvgPoint = ({ x, y }) => ({
    x: originX + x * CELL_SIZE + CELL_SIZE / 2,
    y: originY + y * CELL_SIZE + CELL_SIZE / 2,
  });
  const pathData = route
    .map((point, index) => {
      const svgPoint = toSvgPoint(point);
      return `${index === 0 ? "M" : "L"}${svgPoint.x} ${svgPoint.y}`;
    })
    .join(" ");
  const headPathData = route
    .slice(BASE_SNAKE_LENGTH - 1)
    .map((point, index) => {
      const svgPoint = toSvgPoint(point);
      return `${index === 0 ? "M" : "L"}${svgPoint.x} ${svgPoint.y}`;
    })
    .join(" ");

  const frameTimes = frames.map((_, index) =>
    formatNumber((index * STEP_DURATION_MS) / totalDuration),
  );
  frameTimes.push("1");

  const dashValues = frames.map((frame) => {
    return `${formatNumber(frame.bodyDistance)} ${totalPathLength}`;
  });
  dashValues.push(dashValues.at(-1));
  const dashOffsetValues = frames.map((frame) =>
    formatNumber(-frame.tailDistance),
  );
  dashOffsetValues.push(dashOffsetValues.at(-1));

  const cells = grid.cells
    .map((cell) => {
      const x = originX + cell.x * CELL_SIZE + (CELL_SIZE - DOT_SIZE) / 2;
      const y = originY + cell.y * CELL_SIZE + (CELL_SIZE - DOT_SIZE) / 2;
      const label = cell.date
        ? `${cell.date}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`
        : "Outside GitHub's contribution range";
      const attributes = `class="cell level-${cell.level}" x="${x}" y="${y}" width="${DOT_SIZE}" height="${DOT_SIZE}" rx="2"`;

      if (cell.count === 0) {
        return `    <rect ${attributes}><title>${escapeXml(label)}</title></rect>`;
      }

      const routeIndex = routeIndexes.get(`${cell.x}:${cell.y}`);
      const eatenFrame = routeIndex - (BASE_SNAKE_LENGTH - 1);
      const eatenAt = formatNumber(
        (eatenFrame * STEP_DURATION_MS) / totalDuration,
      );

      return [
        `    <rect ${attributes}>`,
        `      <title>${escapeXml(label)}</title>`,
        `      <animate attributeName="opacity" values="1;0;0" keyTimes="0;${eatenAt};1" calcMode="discrete" dur="${totalDuration}ms" repeatCount="indefinite"/>`,
        "    </rect>",
      ].join("\n");
    })
    .join("\n");

  // A single animated stroke keeps the growing body compact. Hundreds of
  // individually animated rectangles would make both GitHub and the snake sad.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(username)}'s growing contribution snake</title>
  <desc id="description">An animated snake eats ${escapeXml(username)}'s real GitHub contribution days and grows by one segment for every active day.</desc>
  <style>
    :root { --empty: #ebedf0; --l1: #9be9a8; --l2: #40c463; --l3: #30a14e; --l4: #216e39; --snake: #0969da; --eye: #ffffff; }
    @media (prefers-color-scheme: dark) { :root { --empty: #161b22; --l1: #0e4429; --l2: #006d32; --l3: #26a641; --l4: #39d353; --snake: #58a6ff; --eye: #0d1117; } }
    .cell { fill: var(--empty); shape-rendering: crispEdges; }
    .level-1 { fill: var(--l1); } .level-2 { fill: var(--l2); } .level-3 { fill: var(--l3); } .level-4 { fill: var(--l4); }
  </style>
  <g id="contributions">
${cells}
  </g>
  <path d="${pathData}" fill="none" stroke="var(--snake)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashValues[0]}" stroke-dashoffset="${dashOffsetValues[0]}">
    <animate attributeName="stroke-dasharray" values="${dashValues.join(";")}" keyTimes="${frameTimes.join(";")}" calcMode="linear" dur="${totalDuration}ms" repeatCount="indefinite"/>
    <animate attributeName="stroke-dashoffset" values="${dashOffsetValues.join(";")}" keyTimes="${frameTimes.join(";")}" calcMode="linear" dur="${totalDuration}ms" repeatCount="indefinite"/>
  </path>
  <g fill="var(--snake)">
    <circle r="6.5"/>
    <circle cx="2.5" cy="-2.4" r="1.25" fill="var(--eye)"/>
    <circle cx="2.5" cy="2.4" r="1.25" fill="var(--eye)"/>
    <animateMotion path="${headPathData}" keyPoints="0;1;1" keyTimes="0;${formatNumber(movementFraction)};1" calcMode="linear" dur="${totalDuration}ms" repeatCount="indefinite"/>
  </g>
</svg>
`;
}

export async function fetchContributionCalendar(username, githubToken) {
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required to read GitHub contributions");
  }

  const query = `
    query ContributionCalendar($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "JohnnyC0rp-growing-contribution-snake",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors[0].message}`);
  }

  const weeks =
    payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  return normalizeContributionCalendar(weeks);
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
