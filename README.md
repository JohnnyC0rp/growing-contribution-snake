# Growing Contribution Snake

[![Generate profile visuals](https://github.com/JohnnyC0rp/growing-contribution-snake/actions/workflows/generate.yml/badge.svg)](https://github.com/JohnnyC0rp/growing-contribution-snake/actions/workflows/generate.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A real GitHub contribution snake that gains one body segment whenever it eats an active day. The same dependency-free generator also creates a reliable activity graph, so both profile visuals are served as small static SVG files from GitHub instead of a cold-starting web service.

## Live demos

### Growing snake

<img src="https://raw.githubusercontent.com/JohnnyC0rp/growing-contribution-snake/output/github-contribution-grid-snake.svg" alt="Animated snake eating JohnnyC0rp's GitHub contribution graph" width="100%">

### Activity graph

<img src="https://raw.githubusercontent.com/JohnnyC0rp/growing-contribution-snake/output/github-activity-graph.svg" alt="JohnnyC0rp's recent GitHub activity graph" width="100%">

## Use it on a profile

No source edits, package installation, server, Vercel project, personal access token, or repository secret are required.

1. Fork this repository.
2. Open the fork's **Actions** tab and enable workflows.
3. Run **Generate profile visuals** once with **Run workflow**.
4. Add the following images to the profile repository's `README.md`, replacing `YOUR_GITHUB_USERNAME` in the repository URLs:

```html
<img src="https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/growing-contribution-snake/output/github-contribution-grid-snake.svg" alt="Growing GitHub contribution snake" width="100%">

<img src="https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/growing-contribution-snake/output/github-activity-graph.svg" alt="GitHub activity graph" width="100%">
```

The workflow defaults to the fork owner automatically. If the target profile has a different name, create an Actions repository variable named `PROFILE_USERNAME`; no code change is needed.

If the fork is renamed, replace `growing-contribution-snake` in the image URLs with the new repository name.

## How it works

- GitHub Actions runs at 17 minutes past every hour and can also run manually.
- The workflow reads the selected account's public contribution calendar through GitHub's GraphQL API.
- A column-serpentine route visits every contribution cell exactly once.
- The snake begins with three segments and gains exactly one segment per active day it eats.
- Both self-contained SVGs adapt to light and dark color schemes.
- Validated files are committed to the `output` branch and delivered by `raw.githubusercontent.com` with the `image/svg+xml` content type.

The workflow runs only from the default branch, uses the short-lived built-in `github.token`, and has the minimum permission needed to update the `output` branch. Pull requests do not receive a publishing trigger.

## Generated files

| File | Purpose |
| --- | --- |
| `github-contribution-grid-snake.svg` | Animated contribution grid with a growing snake |
| `github-activity-graph.svg` | Static graph of the latest 30 contribution days |

Both files live at the root of the generated `output` branch.

## Local development

Node.js 20 or newer is required. There are no runtime dependencies.

```sh
npm run check
npm test
GITHUB_TOKEN="$(gh auth token)" PROFILE_USERNAME="JohnnyC0rp" npm run generate
npm run validate
```

The token is sent only to `https://api.github.com/graphql` in the authorization header. Never paste a token into source code, commit it, or add it to the profile README.

## License

[MIT](LICENSE)
