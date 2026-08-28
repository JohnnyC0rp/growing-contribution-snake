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

export function buildSerpentineRoute(width, height) {
  const route = Array.from({ length: BASE_SNAKE_LENGTH }, (_, index) => ({
    x: index - BASE_SNAKE_LENGTH,
    y: 0,
  }));

  for (let x = 0; x < width; x += 1) {
    if (x % 2 === 0) {
      for (let y = 0; y < height; y += 1) route.push({ x, y });
    } else {
      for (let y = height - 1; y >= 0; y -= 1) route.push({ x, y });
    }
  }

  return route;
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
  const route = buildSerpentineRoute(grid.width, grid.height);
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

export function renderActivityGraph(grid, username, days = 30) {
  const contributions = grid.cells
    .filter((cell) => cell.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);

  if (contributions.length === 0) {
    throw new Error("The contribution calendar has no dated cells");
  }

  const width = 856;
  const height = 260;
  const margin = { top: 58, right: 22, bottom: 42, left: 58 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(...contributions.map((cell) => cell.count));
  const yMax = niceUpperBound(maxCount);
  const baseline = margin.top + chartHeight;
  const xFor = (index) =>
    margin.left +
    (contributions.length === 1
      ? chartWidth / 2
      : (index / (contributions.length - 1)) * chartWidth);
  const yFor = (count) => baseline - (count / yMax) * chartHeight;
  const points = contributions.map((cell, index) => ({
    ...cell,
    svgX: xFor(index),
    svgY: yFor(cell.count),
  }));
  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"}${formatNumber(point.svgX)} ${formatNumber(point.svgY)}`,
    )
    .join(" ");
  const areaPath = [
    `M${formatNumber(points[0].svgX)} ${baseline}`,
    ...points.map(
      (point) => `L${formatNumber(point.svgX)} ${formatNumber(point.svgY)}`,
    ),
    `L${formatNumber(points.at(-1).svgX)} ${baseline}`,
    "Z",
  ].join(" ");

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = (yMax * index) / 4;
    return {
      value,
      y: yFor(value),
      label: Number.isInteger(value) ? value.toString() : value.toFixed(1),
    };
  });
  const xTickIndexes = Array.from(
    new Set([
      0,
      ...Array.from(
        { length: Math.floor((contributions.length - 1) / 5) },
        (_, index) => (index + 1) * 5,
      ),
      contributions.length - 1,
    ]),
  );
  const firstDate = formatShortDate(contributions[0].date);
  const lastDate = formatShortDate(contributions.at(-1).date);

  const yLabels = yTicks
    .map(
      (tick) =>
        `    <text class="axis-label" x="${margin.left - 10}" y="${formatNumber(tick.y + 4)}" text-anchor="end">${tick.label}</text>`,
    )
    .join("\n");
  const xLabels = xTickIndexes
    .map((index) => {
      const point = points[index];
      return `    <text class="axis-label" x="${formatNumber(point.svgX)}" y="${height - 17}" text-anchor="middle">${escapeXml(formatShortDate(point.date))}</text>`;
    })
    .join("\n");
  const pointElements = points
    .map(
      (point) =>
        `    <circle class="point" cx="${formatNumber(point.svgX)}" cy="${formatNumber(point.svgY)}" r="3"><title>${escapeXml(point.date)}: ${point.count} contribution${point.count === 1 ? "" : "s"}</title></circle>`,
    )
    .join("\n");
  const emptyState =
    maxCount === 0
      ? `\n    <text class="empty-state" x="${margin.left + chartWidth / 2}" y="${margin.top + chartHeight / 2}" text-anchor="middle">No contributions in the last ${contributions.length} days</text>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="activity-title activity-description">
  <title id="activity-title">${escapeXml(username)}'s contribution graph</title>
  <desc id="activity-description">Daily GitHub contributions from ${escapeXml(firstDate)} to ${escapeXml(lastDate)}.</desc>
  <style>
    :root { --text: #0000ff; --muted: #57606a; --axis: #d0d7de; --line: #0000ff; --point: #0000ff; --area: #add8e6; }
    @media (prefers-color-scheme: dark) { :root { --text: #58a6ff; --muted: #8b949e; --axis: #30363d; --line: #58a6ff; --point: #58a6ff; --area: #388bfd; } }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .title { fill: var(--text); font-size: 19px; font-weight: 600; }
    .subtitle, .axis-label, .empty-state { fill: var(--muted); font-size: 11px; }
    .axis { stroke: var(--axis); stroke-width: 1; }
    .area { fill: var(--area); fill-opacity: 0.5; }
    .line { fill: none; stroke: var(--line); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
    .point { fill: var(--point); stroke: var(--point); }
    .empty-state { font-size: 14px; }
  </style>
  <text class="title" x="${width / 2}" y="27" text-anchor="middle">${escapeXml(username)}'s Contribution Graph</text>
  <text class="subtitle" x="${width / 2}" y="45" text-anchor="middle">Last ${contributions.length} days · updated by GitHub Actions</text>
  <g id="axes">
    <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${baseline}"/>
    <line class="axis" x1="${margin.left}" y1="${baseline}" x2="${width - margin.right}" y2="${baseline}"/>
${yLabels}
${xLabels}
  </g>
  <g id="activity">
    <path class="area" d="${areaPath}"/>
    <path class="line" d="${linePath}"/>
${pointElements}${emptyState}
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

function niceUpperBound(value) {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatShortDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
