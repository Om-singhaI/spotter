# Spotter

The gym log that remembers your last set and brings your friends.

## What it is

Most people track their lifts in the Notes app or not at all, so they forget last week's numbers, can't see progress, and quit. Spotter opens every exercise with your last session sitting there as a ghost row to beat, calls personal records the moment they happen, and lets you form a squad with friends. The squad leaderboard ranks people by showing up and by beating their own numbers, never by who lifts the most, so a beginner can win.

## Team

Om Singhal, (add teammates)

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

## How we work

- Every user story is an issue on the [project board](https://github.com/users/Om-singhaI/projects/1). Every sprint is a milestone.
- Branch from `main`, open a pull request, one teammate reviews, then merge. Nothing goes straight to `main`.
- CI runs lint, type checks, and tests on every pull request.
- Discord for daily chat. Two meetings a week: in person after class, and a short call midweek.

## Getting started

Coming in sprint 1. See the scaffolding issue on the board.
