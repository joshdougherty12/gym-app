# CLAUDE.md: Cutline (personal gym app)

Personal project. The spec is `../gym prompt.md`, built in six phases, stopping after each one for
review.

## Keep it separate (critical)

This project is completely separate from every other project on this machine, and from APD
Defense in particular:

- Its own git repo. Never add it as a worktree, branch or subfolder of another repo, and never
  copy code, tooling, branding, names or keys between them.
- Commit with this repo's local git identity (`git config --local user.*`), never the global one.
- Hosting: `joshdougherty12/gym-app` on GitHub Pages (https://joshdougherty12.github.io/gym-app/),
  deployed by `.github/workflows/deploy.yml` on every push to `main`. Git here authenticates through
  a repo-local `credential.helper` that runs `gh` with `GH_CONFIG_DIR=C:\Users\joshu\.gh-gym` (a
  separate personal login). For `gh` commands, set that same `GH_CONFIG_DIR`. Never `gh auth switch`
  the global login, which is a work account used by other sessions.

## Rules from the spec

- TypeScript strict, no `any`. Pure logic goes in `src/lib/` with unit tests.
- Store everything in lb and inches; units only change what is displayed.
- No network calls. Data lives in IndexedDB (Dexie). Schema changes add a new
  `this.version(n + 1)` with an upgrade; never edit a released version.
- 44 px minimum tap targets, labelled controls, visible focus.

## Checks before calling a phase done

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then look at it at phone width.
