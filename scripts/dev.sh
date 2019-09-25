#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Starting dependencies..."
docker rm -f postgres-vulcan2x
docker-compose down 
docker-compose up