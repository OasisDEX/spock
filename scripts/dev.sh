#!/usr/bin/env bash
set -ex
cd "$(dirname "$0")"

echo "Starting dependencies..."
docker rm -f postgres-vulcan2x || true
docker-compose down
docker-compose up
