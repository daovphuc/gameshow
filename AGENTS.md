# Game Show - rules for agents

Static quiz game-show site for GitHub Pages with three portals (host on the projector PC, judges on iPads, teams on iPads). Data (teams, questions, settings) comes from a public Google Sheet; live state (current question, timers, answers, judge scores, totals) lives in Firebase Realtime Database, with an in-browser local mode when no Firebase config is set.

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
- Do not touch `.git/`, add a server of our own, or require a secret key: the site must work on free GitHub Pages with a sheet shared "anyone with the link can view" plus a free (Spark) Firebase project. The Firebase web config (apiKey, databaseURL, ...) is a public identifier and may be committed.
- Load the Firebase JS SDK as ES modules from `https://www.gstatic.com/firebasejs/<exact version>/...`, only in a thin adapter module; logic modules and tests never import it.
