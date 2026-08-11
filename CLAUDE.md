# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session or finishing a change**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

Bun workspace. `just` wraps the root scripts.

```bash
bun install
just up          # Postgres via docker compose
just migrate     # apply packages/db migrations
just dev         # all workspace dev servers
just check       # lint + lint-colors + format-check + typecheck
```

## Architecture Overview

Ratat is a read-mostly art appview over `app.bsky.*` data. See
`.hermes/plans/2026-08-05_ratat-lens-migration.md` for the full plan.

```
apps/web           TanStack Start (React) — XRPC client + OAuth. No Effect.
apps/xrpc-server   Effect — read API serving net.ratat.* query lexicons.
apps/ingester      Effect — jetstream tail + lazy per-DID backfill.
packages/db        Drizzle + Postgres schema and migration runner.
packages/lexicon   net.ratat.graph.follow record + net.ratat.* query lexicons.
packages/common    Shared ATProto helpers.
```

## Conventions & Patterns

- Backend services use Effect. The frontend does not.
- Lint/format via oxlint + oxfmt from the repo root; per-package `typecheck`
  scripts run `tsc --noEmit` against `tsconfig.base.json`.
- Page and component designs are PORTED from the old app at
  `/home/answer/Workspace/ratat/apps/frontend` — copy its layout, JSX structure,
  classes, and CSS one-for-one; never invent a new design. Buttons, inputs, and
  dialogs are square-cornered like the old app. When no old-app equivalent
  exists, stay consistent with its visual language.
- Colours in `apps/web` come from the `light-dark()` tokens in
  `apps/web/src/styles.css`. `bun run lint:colors` rejects hex, `rgb()`/`hsl()`,
  and Tailwind palette classes anywhere in `apps/web/src`; a colour that must
  not flip needs a `theme-invariant` comment on or above the line.
