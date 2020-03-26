#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

./node_modules/.bin/tsc \
  -p tsconfig.build.json \
  --outDir dist
