# CLAUDE.md: Cutline (personal gym app)

Personal project. The spec is `../gym prompt.md`, built in six phases, stopping after each one for
review.

## Keep it separate (critical)

This project is completely separate from every other project on this machine, and from APD
Defense in particular:

- Its own git repo. Never add it as a worktree, branch or subfolder of another repo, and never
  copy code, tooling, branding, names or keys between them.
- Commit with this repo's local git identity (`git config --local user.*`), never the global one.
- Don't push or create a GitHub repo without asking. The global `gh` login is a work account and
  must not host this app.

## Rules from the spec

- TypeScript strict, no `any`. Pure logic goes in `src/lib/` with unit tests.
- Store everything in lb and inches; units only change what is displayed.
- No network calls. Data lives in IndexedDB (Dexie). Schema changes add a new
  `this.version(n + 1)` with an upgrade; never edit a released version.
- 44 px minimum tap targets, labelled controls, visible focus.

## Checks before calling a phase done

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then look at it at phone width.
