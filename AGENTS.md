# Game Show - rules for agents

Static quiz game-show site for GitHub Pages. Data (teams, questions, settings) comes from a public Google Sheet; scores live in the host browser's localStorage.

## Gate
`npm test` (runs `node --test tests/`, a few seconds). Run it before reporting done.
No dependencies: do not add npm packages, bundlers or a build step. `npm install` is not available.

## Layout
- `*.html` at the repo root: the pages (served as-is by GitHub Pages, so all links and fetches use relative paths).
- `js/`: ES modules. Logic modules (CSV parsing, data normalisation, game state, scoring, timer) must not touch the DOM so `node --test` can import them; page scripts wire them to the DOM.
- `css/`: one theme stylesheet driven by CSS custom properties.
- `data/sample/`: CSV files mirroring the Google Sheet tabs; used when no sheet is configured, and by tests.
- `tests/`: `node:test` + `node:assert/strict`, one file per logic module (`*.test.js`).

## Conventions
- Plain HTML/CSS/JS, no frameworks. UI text in Vietnamese; code, comments and tests in English.
- Sheet column names are lowercase snake_case English; documented in README.md.
- Claude commits; workers never commit.

## Do not
- Do not touch `.git/`, add a backend, or require an API key: the site must work on free GitHub Pages with a sheet shared "anyone with the link can view".
