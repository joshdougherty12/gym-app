# CLAUDE.md: RightPace, formerly RightTrack, originally Cutline (personal gym app)

Personal project. The spec is `../docs/gym prompt.md`, built in six phases, stopping after each one for
review.

## Keep it separate (critical)

This project is completely separate from every other project on this machine, and from APD
Defense in particular:

- Its own git repo. Never add it as a worktree, branch or subfolder of another repo, and never
  copy code, tooling, branding, names or keys between them.
- Commit with this repo's local git identity (`git config --local user.*`), never the global one.
- Hosting: `joshdougherty12/gym-app` on GitHub Pages (https://joshdougherty12.github.io/gym-app/),
  deployed by `.github/workflows/deploy.yml` on every push to `main`. Git here authenticates through
  a repo-local `credential.helper` that runs `gh` with `GH_CONFIG_DIR=C:\Users\joshu\RightPace\.private\gh` (a
  separate personal login). For `gh` commands, set that same `GH_CONFIG_DIR`. Never `gh auth switch`
  the global login, which is a work account used by other sessions.

## Rules from the spec

- TypeScript strict, no `any`. Pure logic goes in `src/lib/` with unit tests.
- Store everything in lb and inches; units only change what is displayed.
- Data lives in IndexedDB (Dexie). The only network calls are opt-in: Meal AI (the user's own
  Anthropic key) and the partner link (end-to-end encrypted sync, `server/`, hidden unless the build
  sets `VITE_SYNC_URL`). Link credentials never go into backups or logs. Schema changes add a new
  `this.version(n + 1)` with an upgrade; never edit a released version.
- 44 px minimum tap targets, labelled controls, visible focus.

- Brand strings: new text uses `APP_NAME` from `src/lib/brand.ts` (the name will change again).

## Checks before calling a phase done

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then look at it at phone width.
Server changes: `cd server && npm test && npm run typecheck` (local only; never `wrangler login` or
`deploy` without Joshua).

## Where everything lives (moved 2026-09-27)

Everything for this app is under `C:\Users\joshu\RightPace\` and nowhere else. Nothing for it lives in
any other project's folder, and Claude Code sessions for it start in `C:\Users\joshu\RightPace\app`.

| Path | What |
|---|---|
| `app\` | This repo |
| `docs\gym prompt.md` | The original spec |
| `design\` | Icon concept batches (the app uses 01 Forward from `icon-concepts-2`) |
| `research\` | Name and trademark screens |
| `scratch\` | Throwaway test scripts; put new scratch files here |
| `.private\signing\` | Android release keystore and `keystore.properties`. Never commit or share it; losing it means the installed app can't be updated |
| `.private\gh\` | This repo's own `gh` login (`GH_CONFIG_DIR`) |
| `.private\cloudflare\` | Joshua's personal Cloudflare login for the sync server (`XDG_CONFIG_HOME` for wrangler) |
| `.private\tools\jdk-21*` | JDK 21 for Gradle (the machine's default JDK is too new) |

## Operations

- **Android build** (always pass the sync URL):
  `VITE_SYNC_URL=https://partner-sync.righttrack-sync.workers.dev npm run build:android`, then in
  `android/`: `export JAVA_HOME=$(ls -d /c/Users/joshu/RightPace/.private/tools/jdk-21*) ANDROID_HOME=$LOCALAPPDATA/Android/Sdk && ./gradlew.bat assembleRelease`,
  then `./gradlew.bat --stop`.
- **Install on Joshua's Pixel** over wireless adb (he gives a pairing code when it drops):
  `adb -s <device> install -r android/app/build/outputs/apk/release/app-release.apk`. The appId stays
  `com.joshdougherty.cutline` forever.
- **Web app**: pushing to `main` deploys GitHub Pages; the repo variable `VITE_SYNC_URL` feeds the build.
- **Sync server** (`server/`): worker `partner-sync` on Joshua's personal Cloudflare account, at the URL
  above. Deploy only with his go-ahead, using only this login:
  `XDG_CONFIG_HOME='C:\Users\joshu\RightPace\.private\cloudflare' npx wrangler deploy`.
- **Versions**: MAJOR.MINOR.PATCH in `package.json` and `build.gradle`; bump `versionCode` for every
  installed build.
- **Commits** end with the line `Authored by: Joshua D.` and nothing else.
