# Masters club score tracker

Interactive cumulative club scores for Swim England Masters 2026.

## Local development

Requires Node.js 22.18+ and Python 3.

```sh
npm ci
npm run dev
```

`npm run build` recalculates scores from the cleaned `results/E*.json` files, builds the site into `dist/`, and checks that no raw JSON, processing scripts, or source maps are published. `npm test` checks cumulative totals, session boundaries, and tied ranks.

## How it works

- Event mode shows cumulative scores after each completed event.
- Session mode takes the last event snapshot in each event-number hundreds group (101 = session 1, 201–207 = session 2, etc.).
- Combined scores are shown by default; Open and Female filters show category scores. Mixed relay points remain in Combined.
- The top eight clubs are selected initially; every scoring club can be searched and selected.
- Hover/tap the chart for comparisons, or use the checkpoint selector and table for exact scores. Table places are across all clubs, not just selected clubs. Gained points are relative to the previous event/session.
- Scoring uses the existing calculator: 7, 5, 4, 3, 2, 1 for places 1–6 in each age group. These are calculated, not official standings.

## Cloudflare Pages

Project: `se-masters-scores`
Site: https://se-masters-scores.pages.dev

Connected directly to GitHub repository `crsimmons/se-masters-scores`:
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root
- Preview deployments: all other branches

Automatic deployments are enabled in Cloudflare, but GitHub pushes did not trigger builds during initial setup. Check that the Cloudflare Pages GitHub app has access to this repository at https://github.com/settings/installations. The site was deployed successfully by triggering a build from the GitHub branch:

```sh
cloudflare pages deployments create se-masters-scores --branch main
```

Once GitHub app access/webhooks are working, pushes to `main` should deploy automatically. Cleaned event results must be committed so Cloudflare can recalculate scores at build time.

Only `dist/` is served. Raw result files and Python/build scripts remain in the repository, not the website. The browser bundle contains only derived event names and club score snapshots needed for the graph. Those displayed scores are public, not secret. Source maps are disabled.
