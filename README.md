# Growing Contribution Snake

[![Generate contribution snake](https://github.com/JohnnyC0rp/growing-contribution-snake/actions/workflows/generate.yml/badge.svg)](https://github.com/JohnnyC0rp/growing-contribution-snake/actions/workflows/generate.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A real GitHub contribution snake that gains one body segment whenever it eats an active day. The dependency-free generator serves it as a small static SVG file from GitHub instead of a cold-starting web service.

## Live demo

<img src="https://raw.githubusercontent.com/JohnnyC0rp/growing-contribution-snake/output/github-contribution-grid-snake.svg" alt="Animated snake eating JohnnyC0rp's GitHub contribution graph" width="100%">

## Use it on a profile

No source edits, package installation, server, Vercel project, personal access token, or repository secret are required.

1. Fork this repository.
2. Open the fork's **Actions** tab and enable workflows.
3. Run **Generate contribution snake** once with **Run workflow**.
4. Add the following image to the profile repository's `README.md`, replacing `YOUR_GITHUB_USERNAME` in the repository URL:

```html
<img src="https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/growing-contribution-snake/output/github-contribution-grid-snake.svg" alt="Growing GitHub contribution snake" width="100%">
```

The workflow defaults to the fork owner automatically. If the target profile has a different name, create an Actions repository variable named `PROFILE_USERNAME`; no code change is needed.

If the fork is renamed, replace `growing-contribution-snake` in the image URLs with the new repository name.

## How it works

- GitHub Actions runs at 17 minutes past every hour and can also run manually.
- The workflow reads the selected account's public contribution calendar through GitHub's GraphQL API.
- A seeded backbite route visits every contribution cell exactly once and changes with the latest calendar date.
- The snake begins with three segments and gains exactly one segment per active day it eats.
- The self-contained SVG adapts to light and dark color schemes.
- The validated file is committed to the `output` branch and delivered by `raw.githubusercontent.com` with the `image/svg+xml` content type.

The workflow runs only from the default branch, uses the short-lived built-in `github.token`, and has the minimum permission needed to update the `output` branch. Pull requests do not receive a publishing trigger.

## Generated file

| File | Purpose |
| --- | --- |
| `github-contribution-grid-snake.svg` | Animated contribution grid with a growing snake |

The file lives at the root of the generated `output` branch.

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
