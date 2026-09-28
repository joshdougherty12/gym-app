# RightPace — Get there the right way.

(Formerly RightTrack, originally Cutline. The Android app ID, database names and backup marker keep the old name so existing installs and backups carry over.)

A personal workout and fat-loss tracker: a 12-week program engine with automatic progression,
workout logging with a rest timer, body and nutrition tracking, weekly calorie reviews and a
progress dashboard. Phone-first, installable as a PWA, fully offline.

**All data stays in this browser (IndexedDB). No accounts.** Two opt-in features use the network: Meal AI
(your own Anthropic key) and the **partner link** (below), which syncs end-to-end encrypted data through a
small server in `server/`. With no `VITE_SYNC_URL` at build time the partner link is hidden.

**Live:** https://joshdougherty12.github.io/gym-app/ · Spec: `../docs/gym prompt.md`

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
| **Workout** | One exercise at a time (or a list): last session's sets, today's suggested weight/reps **and why**; big steppers for weight/reps/RIR (tap a number to type); per-side reps; a hold timer for planks and other timed sets; rest timer (2:30 compound, 1:15 isolation) that beeps and vibrates; swap exercise, add/remove sets, warm-ups (don't count), notes; everything autosaved; finish summary with volume, PRs and next-time changes |
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
  Timed holds add 5 s up to the top, then a harder variation (never added weight). Assisted pull-ups take the help
  away by the increment. Per-side sets progress on the weaker side.
- **Weekly review:** 7-day average vs the previous 7 days; needs 5 weigh-ins in each. Losing > 1 lb/week →
  +100-150 kcal; < 0.5 lb over two weeks (or gaining) → −100-150 kcal or +2,000 steps (your choice);
  0.5-1 lb/week → no change.
- **Strength drop:** top set or e1RM on a main lift down 2+ trained weeks running (deloads ignored) → a
  warning with a one-tap extra deload week.
- **Shifting the program** takes whole weeks off from a Monday; the program holds at its week and resumes there.

Increments default to the gym's equipment: barbell +5 lb total (2.5 lb plates), dumbbells +5 lb (the weight
field is one dumbbell), cables and most machines +2.5 lb, plate-loaded machines +5 lb.

### Partner link (1.8)

**Settings → Partner → Link partner** shows a QR code and a link code. On an iPhone, the Camera opens the
link in Safari (tap **Link**); in the Android app, or in a Home Screen web app that already has data, use
**Enter link code** and paste it. Two people per household; **Unlink** on either phone stops sharing for
both, and each keeps what is on their own phone.

- **Shared:** week plan and dinner picks, the grocery list (item by item, so both can check off at the store),
  saved recipes, workout summaries (session, time, sets, new records; never body weight), run/walk/ride summaries
  (distance, time, pace; never the route), high-fives and nudges,
  "I ate this" (recipe name and per-serving numbers), and each person's calorie target (for suggested
  portions; can be turned off).
- **Private:** body weight, check-ins, photos, individual meal logs.
- Every record is encrypted on the phone (AES-GCM, key made on the phone, carried only in the link code).
  The server stores ciphertext and a hash of the household secret. Design and deploy steps: `server/README.md`.
- Backups include the grocery list and saved recipes (they are also on this phone) but never the link
  credentials or the partner's records. Restoring a backup while linked re-pulls the shared kitchen.

### Steps (1.9)

- **Android app:** Settings → Steps → **Turn on step counting**, then **Allow** "Physical activity". The phone's
  hardware step counter is read by a quiet foreground service (Android only counts while an app listens; a
  silent "Counting steps" notification shows), plus a 15-minute WorkManager reading and a reading after every
  reboot or app update. Steps count from when it was turned on. Per-day totals live natively
  (`android/.../steps/StepLedger.java`, JUnit-tested: reboot resets, stale batched events, midnight split in
  proportion to time) and are copied into the check-in when the app opens and every minute while it is open.
- **iPhone (web app):** Settings → Steps explains an Apple Health Shortcut. Its link
  `#/steps/import?date=YYYY-MM-DD&steps=N` (or `d=YYYY-MM-DD:N,...`) saves steps; values must be whole
  numbers up to 100,000 within the last 60 days. Shortcuts' "Open URLs" always opens Safari, whose storage is
  separate from a Home Screen web app, so Home Screen users copy the link to the clipboard in the Shortcut and
  tap **Paste steps from Shortcut** on Today.
- A typed-in number always wins for that day; clearing it goes back to the counted or imported value.
  Today shows a ring against the step goal; Progress shows 7/30-day bars with the goal line.
- **Partner:** "Share my steps" (off by default) sends today's count as an encrypted `steps` record.
  Older app versions ignore the new record type; the server needs no change.

### GPS activities (1.10)

- **Start:** Today → **Start a run or ride** (or Progress → Runs, walks and rides → Start one). Pick Run, Walk, Ride or
  Hike, then **Start**. Live: moving time, distance, current and average pace (speed for rides), the current mile/km,
  elapsed time and approximate climb, a live map (Hide map saves battery and data) and the splits. **Pause**/**Resume**;
  **Hold to finish** (or tap it and confirm); **Discard** while paused. Auto-pause (on by default) stops the clock
  when you stand still; an optional buzz and beep marks each mile or km.
- **Android app:** a foreground service (type `location`, `android/.../activity/ActivityTrackerService.java`) records
  the platform GPS provider once a second with the screen off or the app in the background, with a "Tracking run ·
  1.24 mi · 12:03" notification (Pause/Resume, Open). It is only started from a visible tap, so "while in use" location
  is enough; the app never asks for background location. Fixes are kept in `filesDir/activity` (header rewritten
  atomically, fixes appended and flushed every 5 s), so an activity survives the web view or the app being killed: on
  the next open the app picks it up again (a gap starts a new segment) or saves one that was finished but not saved.
  Pure logic (distance filter, active time, points file) is JUnit-tested in `TrackMath`.
- **iPhone / web:** `navigator.geolocation` with the screen kept on; every fix is saved to IndexedDB so a reload
  resumes. Web apps can't track in the background, and the tracker says so.
- **Processing** (`src/lib/activity/`, unit-tested): fixes worse than 30 m accuracy, out of order or faster than the
  activity allows are dropped; each segment is Kalman-smoothed; distance by haversine; auto-pause when the
  6-second displacement speed is under the activity's threshold; splits interpolated at each mile/km; elevation gain with
  3 m hysteresis (labelled approximate); calories = MET (by activity and speed) × latest logged weight (else the setup
  weight) × moving hours.
- **Stored route:** the smoothed track simplified with Douglas-Peucker at 3 m (`route.ts`): within GPS error of the
  full track and 5-10× smaller. Stats are computed from the full track before simplifying. GPX 1.1 export uses it.
- **Saved:** Dexie v7 `activities` (plus the in-progress session and, on the web, its fixes). Each activity also writes
  a cardio entry with the same id (run/walk/ride/hike), so weekly cardio minutes count it. Backups include activities
  with routes. Location stays on the phone; the only network use is map tiles.
- **Map:** Leaflet with OpenStreetMap tiles (`src/lib/activity/mapConfig.ts`); a plain line on a grid when offline.
  OSM's tile policy does not cover a commercial app: switch to a paid tile provider before selling it.
- **Partner:** "Run, walk and ride summaries" in Settings → Partner → *What your partner sees* shares type, date,
  distance, moving time and pace as an `asum` record. Never the route or coordinates.

### Holds and pull-up progressions (1.11)

- **Hold timer:** timed exercises (plank, RKC plank, side plank, hollow body hold) show a big stopwatch ring in the open
  set. Tap it (or **Start**): a 3-2-1 "get set", then it counts up and fills toward the target, chimes and turns green
  at the target, and keeps counting until **Stop**, which fills in the seconds (still editable) for **Log set**. Side
  planks run the left side, a 5-second switch, then the right, and log the weaker side. Sounds and buzzes follow the
  rest-timer settings; the screen stays on while it runs. Logic in `src/lib/holdTimer.ts` (unit-tested).
- **Pull-ups for every level:** "Weighted pull-up" and "Weighted chin-up" are now **Pull-up** and **Chin-up** (added
  weight optional), plus **Assisted pull-up (machine)**, **Band-assisted pull-up** and **Negative pull-up**. The
  assisted machine logs the help (shown as BW−40); less help is progress, so double progression lowers it, and
  e1RM, records and the strength trend use bodyweight minus help. New lifters' generated programs get a pulldown or
  an assisted version instead of unassisted pull-ups.
- **Swapping** on the Program tab works again (the list was empty). A swap between reps and a timed hold resets the
  range to that type's default, so 8 reps don't become 8 seconds.
- Dexie v8 renames stored "Weighted" pull-ups the user hadn't renamed and takes the added-weight setting off timed holds.

### Accent colors (1.12)

- **Settings → Display → Accent color:** Orange (default), Barbie pink or Olive drab. Barbie pink also turns every
  checkmark into a heart and scatters faint little hearts over the background. Until one is picked, a linked
  couple's phones choose their own (`src/lib/accent.ts`): pink when this phone's name starts with "Soph" and the
  partner's with "Jo", olive drab the other way round, orange for everyone else.
- On that same "Soph" phone, a full-screen note from "Hubband" opens with the app once a day (`LoveNote.tsx`).

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

This repo authenticates with its own `gh` login (`GH_CONFIG_DIR=C:\Users\joshu\RightPace\.private\gh`, wired in through
the repo-local `credential.helper`), so `git push` here never uses any other account.
