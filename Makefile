.PHONY: up down logs ps test wasm psql redis-cli

up:
	docker compose up --build

down:
	docker compose down -v

logs:
	docker compose logs -f

ps:
	docker compose ps

test:
	docker compose --profile test run --rm test
	docker compose --profile test run --rm web-test

wasm:
	docker compose --profile wasm run --rm wasm

psql:
	docker compose exec db psql -U office -d office_engine

redis-cli:
	docker compose exec redis redis-cli
