set dotenv-load := false
set positional-arguments := true

set shell := ["mise", "x", "--", "sh", "-c"]

support := "docker compose -f docker-compose.yml -p $COMPOSE_PROJECT_NAME"

_default:
    @just --list --unsorted

up:
    {{ support }} up -d --wait

down:
    -pitchfork stop -l
    -{{ support }} down --remove-orphans

down-hard:
    -pitchfork stop -l
    -{{ support }} down --remove-orphans -v

start-all: up migrate dev

# Start this worktree with its isolated ports and Compose project.
worktree-start: start-all

# Restart every local development daemon, including Postgres via pitchfork.
restart:
    pitchfork restart -l

migrate:
    bun run migrate

dev:
    pitchfork start -l

smoke:
    bun run smoke

test:
    bun run test

network target:
    @test "{{ target }}" = public \
      || { echo "network: expected 'public', got '{{ target }}'" >&2; exit 2; }
    MISE_ENV=public pitchfork restart api web
    @echo "network is now public — run 'export MISE_ENV=public' to move this shell too"

check: lint lint-colors format-check typecheck test

lint:
    bun run lint

lint-colors:
    bun run lint:colors

format-check:
    bun run format:check

typecheck:
    bun run typecheck
