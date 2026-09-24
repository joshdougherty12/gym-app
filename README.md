# Cutline

A personal workout and fat-loss tracker: a 12-week program engine with automatic progression,
workout logging with a rest timer, body and nutrition tracking, weekly calorie reviews and a
progress dashboard. Phone-first, installable as a PWA, fully offline.

**All data stays in this browser (IndexedDB). No accounts, no backend, no network calls.**

**Live:** https://joshdougherty12.github.io/gym-app/ · Spec: `../gym prompt.md`

## Install on Android

1. Open the live URL in **Chrome** on the phone.
2. Menu (⋮) → **Add to Home screen** → **Install**.
3. Open it from the home-screen icon. It runs full-screen and works offline.

**Updates:** when a new version is deployed, a "A new version is ready · Reload" bar appears the
next time you open the app. It never appears (and never reloads the app) during a workout.

Your data is tied to this URL on this phone. Use **Settings → Download backup** now and then; the
"with photos" backup includes progress photos. **Restore from backup file** replaces everything.

## What's in it

| Tab | What it does |
|---|---|
| **Today** | Week, phase, target RIR; today's session with **Start workout**; daily check-in (weight, steps, calories, protein, fatigue 1-5); cardio log; week setup prompts; strength-drop warning; week-12 card |
| **Workout** | One exercise at a time (or a list): last session's sets, today's suggested weight/reps **and why**; big steppers for weight/reps/RIR (tap a number to type); per-side reps; timed sets; rest timer (2:30 compound, 1:15 isolation) that beeps and vibrates; swap exercise, add/remove sets, warm-ups (don't count), notes; everything autosaved; finish summary with volume, PRs and next-time changes |
| **Program** | Weeks 0-12 with phases, each week's days and completion; week setup; edit sessions (swap, sets, reps, rest, increments, per-week extra sets); move sessions between days |
| **Progress** | Green/yellow/red status with reasons; top set + Epley e1RM per lift; weekly sets per muscle vs 10; adherence (workouts, step goal); PR history |
| **Body** | Weekly review (accept a calorie or step change); weight with 7-day moving average; waist; progress photos with side-by-side compare; nutrition vs targets; cardio |
| **Settings** | Units (lb/in or kg/cm, always stored in lb/in), theme, targets, rest timer, increments, start date and program shifts, schedule, backup/restore, demo mode, reset |

### Program rules (from the spec)

- **Week 0** (start date to the first Sunday): find starting weights at 2-3 RIR. Week 1 starts on Monday.
- **Weeks 1-4** 2-3 RIR, optional +1 set to shoulders and core. **Weeks 5-8** 1-2 RIR, +1 set on lateral
  raises, rear delts and the weakest lift you pick, plus a cardio bump (4th zone 2 session or finisher +5 min).
  **Week 9** deload: about 40% fewer sets (at least 1 per exercise), same weights, 4 RIR.
  **Weeks 10-12** last set of each main lift to 0-1 RIR; the workout shows your week 8 best.
- **After week 12** the week-12 screen shows the trend and lets you keep cutting (weeks 5-8 style, a
  deload every 5th week) or move to a small surplus (estimated maintenance + 200 kcal).
- **Double progression:** top of the range on every working set at the target RIR → +increment and reps
  back to the bottom; otherwise same weight and +1 rep on sets below the top. Below the range two sessions
  running → drop ~5-10% (flagged). Logged RIR ≥ 2 above target → bigger jump; ≥ 2 below → hold.
  Timed sets add 5 s up to the top, then weight or a harder variation. Per-side sets progress on the weaker side.
- **Weekly review:** 7-day average vs the previous 7 days; needs 5 weigh-ins in each. Losing > 1 lb/week →
  +100-150 kcal; < 0.5 lb over two weeks (or gaining) → −100-150 kcal or +2,000 steps (your choice);
  0.5-1 lb/week → no change.
- **Strength drop:** top set or e1RM on a main lift down 2+ trained weeks running (deloads ignored) → a
  warning with a one-tap extra deload week.
- **Shifting the program** takes whole weeks off from a Monday; the program holds at its week and resumes there.

Increments default to the gym's equipment: barbell +5 lb total (2.5 lb plates), dumbbells +5 lb (the weight
field is one dumbbell), cables and most machines +2.5 lb, plate-loaded machines +5 lb.

### Demo mode

**Settings → Open demo mode** loads about ten weeks of generated history (the real progression engine
picks the weights) into a **separate database**, so the charts and reviews can be previewed without
touching real data. **Exit demo** switches back and deletes the demo database.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: all progression, review, calendar, stats and backup logic
npm run typecheck
npm run lint
npm run build      # static site in dist/, with service worker
npm run preview    # serve dist/ at http://localhost:4173
```

```
src/
  types.ts      domain types (everything stored in lb / inches)
  data/         exercise library and the 12-week program, as data
  lib/          pure, unit-tested logic: progression, weekly review, maintenance, strength trend,
                status, per-muscle volume, adherence, e1RM, moving average, calendar, week plan
  db/           Dexie schema (versioned), seed, repository + hooks, backup/restore
  store/        in-progress workout (autosaved to IndexedDB) and rest timer
  dev/          demo data generator and demo mode
  components/   shared UI and charts
  screens/      Today, Workout, Summary, Program, Session, Progress, Body, Week 12, Settings
```

Schema changes add a new `this.version(n + 1)` with an upgrade in `src/db/db.ts`; never edit a released
version. New settings fields get their defaults from `withDefaults`, so no migration is needed for them.

## Deploy

Every push to `main` runs tests, lint and build in GitHub Actions and publishes `dist/` to GitHub Pages
(`.github/workflows/deploy.yml`). The build uses a relative base, so it also works on Netlify, Vercel or any
static host: upload `dist/`.

This repo authenticates with its own `gh` login (`GH_CONFIG_DIR=C:\Users\joshu\.gh-gym`, wired in through
the repo-local `credential.helper`), so `git push` here never uses any other account.
