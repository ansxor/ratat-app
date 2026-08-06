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

test:
    bun run test

# One live request per art.ratat.* query, against a server this starts if one
# is not already listening. Needs Postgres up (`just up`) and the network.
smoke:
    bun run smoke

lint:
    bun run lint

lint-colors:
    bun run lint:colors

format-check:
    bun run format:check

typecheck:
    bun run typecheck

check: lint lint-colors format-check typecheck test
