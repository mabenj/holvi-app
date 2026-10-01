#!/usr/bin/env bash
# The demo environment: a local, production-built Holvi from the current
# working tree, with its own database and data, seeded the first time. See
# usage below and the README's "Demo environment".
#
# Always the compose project holvi-demo, so the deploy docker-compose.yml and
# the dev setup are never touched. Works from Git Bash on Windows too.

set -euo pipefail

cd "$(dirname "$0")"

readonly PROJECT=holvi-demo
readonly COMPOSE_FILE=demo/docker-compose.yml
# Optional and uncommitted, e.g. HOLVI_GEO_API_KEY=<a real key>
readonly ENV_FILE=demo/.env.local
readonly URL=http://localhost:7100

usage() {
    cat >&2 <<EOF
Usage: ./demo.sh <command>

  up [--no-open]   Build the working tree, start the demo and seed it if it is
                   empty, then open $URL (not with --no-open)
  down             Stop the demo and keep its data
  reset            Stop the demo and delete its data; the next up seeds again
  logs             Follow the app's logs
EOF
}

compose() {
    if [ -f "$ENV_FILE" ]; then
        docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" \
            --env-file "$ENV_FILE" "$@"
    else
        docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" "$@"
    fi
}

not_ready() {
    echo >&2
    echo "The demo is not ready: $1" >&2
    exit 1
}

open_browser() {
    case "$(uname -s)" in
        MINGW* | MSYS* | CYGWIN*) cmd.exe //c start "" "$1" ;;
        Darwin) open "$1" ;;
        *)
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "$1" >/dev/null 2>&1 &
            else
                echo "Open $1 in your browser"
            fi
            ;;
    esac
}

# Each build leaves the image it replaces untagged, several GB each time.
# Removes those of this project only: untagged, labelled holvi-demo, and not
# used by any container.
remove_stale_images() {
    docker image prune --force \
        --filter "label=com.docker.compose.project=$PROJECT" >/dev/null ||
        echo "Could not remove the demo's stale images" >&2
}

up() {
    local open=true
    for arg in "$@"; do
        case "$arg" in
            --no-open) open=false ;;
            *)
                usage
                exit 2
                ;;
        esac
    done

    echo "Building the demo..."
    compose build db app || not_ready "the build failed (see above)"

    echo
    echo "Starting the demo..."
    local started=true
    compose up --detach --wait --wait-timeout 300 db app || started=false
    # Only now are the images the previous containers ran on unused
    remove_stale_images
    [ "$started" = true ] ||
        not_ready "the app did not start. See ./demo.sh logs"

    echo
    echo "Seeding the demo if it is empty..."
    compose run --rm --no-TTY seed ||
        not_ready "seeding or its checks failed (see above).
Run ./demo.sh reset and then ./demo.sh up to seed it again from scratch."

    # As the app got it, whether from the shell, demo/.env.local or the default
    local shuffle_period
    shuffle_period=$(compose exec -T app printenv HOLVI_SHUFFLE_PERIOD_MINUTES)

    cat <<EOF

The demo is running at $URL
  Sign in as demo / demo1234 (owns the scenarios)
          or other / other1234 (the second User)
  Shuffle period: $shuffle_period minute(s)
  Stop it with ./demo.sh down; only ./demo.sh reset deletes its data.
EOF

    if [ "$open" = true ]; then
        open_browser "$URL"
    fi
}

if ! command -v docker >/dev/null 2>&1; then
    echo "The demo needs Docker with Docker Compose" >&2
    exit 1
fi

case "${1:-}" in
    up)
        shift
        up "$@"
        ;;
    down) compose down --remove-orphans ;;
    reset) compose down --volumes --remove-orphans ;;
    logs) compose logs --follow app ;;
    *)
        usage
        exit 2
        ;;
esac
