set dotenv-load := true
set positional-arguments := true

_default:
    @just --list --unsorted

up:
    docker compose up -d --wait

down:
    -docker compose down --remove-orphans

down-hard:
    -docker compose down --remove-orphans -v

migrate:
    bun run migrate

dev:
    bun run dev

lint:
    bun run lint

lint-colors:
    bun run lint:colors

format-check:
    bun run format:check

typecheck:
    bun run typecheck

check: lint lint-colors format-check typecheck
