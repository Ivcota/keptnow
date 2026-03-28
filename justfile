default: dev

dev:
    #!/usr/bin/env bash
    set -euo pipefail

    cleanup() {
        echo ""
        echo "Shutting down..."
        docker compose down
    }
    trap cleanup EXIT

    echo "Starting infrastructure..."
    docker compose up -d

    echo "Waiting for Postgres to be ready..."
    until docker compose exec db pg_isready -U root -d local -q; do
        sleep 1
    done

    echo "Pushing schema..."
    npm run db:push

    echo "Starting dev server..."
    npm run dev

studio:
    npm run db:studio
