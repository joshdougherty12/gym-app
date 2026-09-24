# Cutline

A personal workout and fat-loss tracker: a 12-week program engine, workout logging, body and
nutrition tracking. Phone-first, installable as a PWA, fully offline. **All data stays in this
browser (IndexedDB). No accounts, no backend, no network calls.**

The spec is `../gym prompt.md`. The app is built in six phases.

**Live:** https://joshdougherty12.github.io/gym-app/

## Deploy

Every push to `main` runs the tests, lint and build in GitHub Actions and publishes `dist/` to
GitHub Pages (`.github/workflows/deploy.yml`). The repo uses its own credentials: a separate `gh`
login in `C:\Users\joshu\.gh-gym` wired in through the repo-local `credential.helper`, so
`git push` here never uses any other account.

## Install on Android

1. Open the live URL in **Chrome** on the phone.
2. Menu (⋮) → **Add to Home screen** → **Install**.
3. Open it from the home-screen icon. It runs full-screen and works offline; updates arrive the
   next time it's opened with a connection.

Your data lives in that installed app on the phone (IndexedDB), tied to this URL. It is never
uploaded. Use **Settings → Download backup** now and then.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run typecheck
npm run lint
npm run build      # static site in dist/, with service worker
npm run preview    # serve dist/ at http://localhost:4173
```

## Layout

```
src/
  types.ts      domain types (everything stored in lb / inches)
  data/         exercise library and the 12-week program, as data
  lib/          pure, unit-tested logic (progression, e1RM, moving average, calendar, week plan, history)
  db/           Dexie schema (versioned), seed, repository + hooks
  components/   shared UI
  store/        in-progress workout (autosaved to IndexedDB) and rest timer
  screens/      Today, Workout, Summary, Program, Session, Settings (Progress/Body in later phases)
```

## Program calendar

- The program starts on the **start date** (Settings). If that isn't a Monday, the days up to the
  following Sunday are **week 0** (intro: find starting weights). Week 1 begins on the next Monday.
- **Shifting the program** takes whole weeks off from a Monday: the program holds at the week it
  was in and resumes there afterwards. Logged workouts keep the week they were logged under.

## Weight increments

The weight field is the barbell total, or one dumbbell. Defaults: barbell +5 lb (2.5 lb plates
each side), dumbbells +5 lb, cable and selectorised machines +2.5 lb, plate-loaded machines +5 lb.
Every exercise's increment can be edited.
