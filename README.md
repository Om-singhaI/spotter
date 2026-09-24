# Spotter

The gym log that remembers your last set and brings your friends.

## What it is

Most people track their lifts in the Notes app or not at all, so they forget last week's numbers, can't see progress, and quit. Spotter opens every exercise with your last session sitting there as a ghost row to beat, calls personal records the moment they happen, and lets you form a squad with friends. The squad leaderboard ranks people by showing up and by beating their own numbers, never by who lifts the most, so a beginner can win.

## Team

Om Singhal and Jacob Heffelmire

## Planned stack

| Area | Tools |
| --- | --- |
| Front end | React, Vite, TypeScript, Tailwind CSS, Recharts, installable PWA |
| Back end | Node, Express, TypeScript, Zod, Socket.IO |
| Database | PostgreSQL on Supabase, which also handles auth |
| Testing | Vitest, Supertest, Playwright, coverage reported in GitHub Actions |
| Hosting | Vercel (web), Render (API), Supabase (database) |
| Exercise data | [free exercise database](https://github.com/yuhonas/free-exercise-db), public domain |

## Sprints

Five sprints of two weeks. Dates are a first guess and will be lined up with the syllabus.

| Sprint | Dates | Goal |
| --- | --- | --- |
| 1 | Sep 21 to Oct 4 | Foundation: repo, CI, login, schema, exercise seed, live hello world |
| 2 | Oct 5 to Oct 18 | Logging: workouts, sets, the ghost row, history |
| 3 | Oct 19 to Nov 1 | Progress: records, one rep max, charts, streaks, plate calculator. Midterm demo. |
| 4 | Nov 2 to Nov 15 | Squads: friends, live feed, spots, leaderboard, privacy |
| 5 | Nov 16 to Nov 29 | Polish: offline stretch goal, testing push, rehearsal. Final demo in December. |

## Weekly plan

Sprints are two weeks because the course asks for that, but we ship something every week. Every card on the board has a Week, and the This week view shows what is due.

| Week | Dates | What ships |
| --- | --- | --- |
| 1 | Sep 21 to 27 | Repo scaffold, CI, database schema, team setup |
| 2 | Sep 28 to Oct 4 | Live hello world, login, exercise library |
| 3 | Oct 5 to 11 | Start a workout, add exercises from the library |
| 4 | Oct 12 to 18 | Log sets with the ghost row, history, installable app shell |
| 5 | Oct 19 to 25 | Record detection, one rep max, progress charts |
| 6 | Oct 26 to Nov 1 | Streaks, plate calculator, midterm demo |
| 7 | Nov 2 to 8 | Friends, squads, live feed |
| 8 | Nov 9 to 15 | Spots, leaderboard, privacy controls |
| 9 | Nov 16 to 22 | Testing push, offline logging stretch goal |
| 10 | Nov 23 to 29 | Seed data, phone testing, rehearsal, packaged submission |

## How we work

- Every user story is an issue on the [project board](https://github.com/users/Om-singhaI/projects/1). Every sprint is a milestone.
- Branch from `main`, open a pull request, one teammate reviews, then merge. Nothing goes straight to `main`.
- CI runs lint, type checks, and tests on every pull request.
- Discord for daily chat. Two meetings a week: in person after class, and a short call midweek.

## Getting started

You need Node 22 or newer and npm.

```bash
git clone https://github.com/Om-singhaI/spotter.git
cd spotter
npm install
npm run dev
```

That starts both apps. The web app is at http://localhost:5173 and the API is at http://localhost:3000. In development the web app proxies `/api/*` to the API, so `http://localhost:5173/api/health` reaches the API's `/health`.

The repo is an npm workspace with two packages:

| Folder | What it is | Dev command |
| --- | --- | --- |
| `web/` | React app built with Vite, TypeScript, and Tailwind | `npm run dev -w web` |
| `api/` | Express API in TypeScript, with Zod for validation | `npm run dev -w api` |

Scripts that run from the repo root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start web and api together |
| `npm run lint` | ESLint over both packages |
| `npm run format` | Prettier, writes changes |
| `npm run format:check` | Prettier, check only (what CI runs) |
| `npm run typecheck` | TypeScript in both packages |
| `npm run build` | Production builds for both packages |

The API reads `PORT` from the environment and falls back to 3000.
