# Game Show - rules for agents

Static quiz game-show site for GitHub Pages with three portals (host on the projector PC, judges on iPads, teams on iPads). Content (teams, questions, judges, accounts, settings) is edited by the host on `content.html` and stored under `content/` in the live backend, falling back to `data/sample/*.csv` when empty; live state (current question, timers, answers, judge scores, totals) lives in Firebase Realtime Database, with an in-browser local mode when no Firebase config is set.

## Gate
`npm test` (runs `node --test tests/`, a few seconds). Run it before reporting done.
No dependencies: do not add npm packages, bundlers or a build step. `npm install` is not available.

## Layout
- `*.html` at the repo root: the pages (served as-is by GitHub Pages, so all links and fetches use relative paths).
- `js/`: ES modules. Logic modules (CSV parsing, data normalisation, game state, scoring, timer) must not touch the DOM so `node --test` can import them; page scripts wire them to the DOM.
- `css/`: one theme stylesheet driven by CSS custom properties.
- `data/sample/`: seed CSV files (one per content tab); used when `content/` is empty, by "Nạp dữ liệu mẫu", and by tests.
- `images/`: team and question images, committed to the repo and referenced by file name.
- `tests/`: `node:test` + `node:assert/strict`, one file per logic module (`*.test.js`).

## Conventions
- Plain HTML/CSS/JS, no frameworks. UI text in Vietnamese; code, comments and tests in English.
- Content field names are lowercase snake_case English; documented in README.md.
- Claude commits; workers never commit.

## Do not
- Do not touch `.git/`, add a server of our own, or require a secret key: the site must work on free GitHub Pages plus a free (Spark) Firebase project; images live in the repo, not in Firebase Storage or the database. The Firebase web config (apiKey, databaseURL, ...) is a public identifier and may be committed.
- Load the Firebase JS SDK as ES modules from `https://www.gstatic.com/firebasejs/<exact version>/...`, only in a thin adapter module; logic modules and tests never import it.
