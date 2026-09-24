# Cutline

A personal workout and fat-loss tracker: a 12-week program engine, workout logging, body and
nutrition tracking. Phone-first, installable as a PWA, fully offline. **All data stays in this
browser (IndexedDB). No accounts, no backend, no network calls.**

The spec is `../gym prompt.md`. The app is built in six phases; this README is completed in phase 6
(deployment and install steps).

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
  lib/          pure, unit-tested logic (calendar, week plan, schedule, units, rest)
  db/           Dexie schema (versioned), seed, repository + hooks
  components/   shared UI
  screens/      Today, Program, Session, Settings (Progress/Body in later phases)
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
