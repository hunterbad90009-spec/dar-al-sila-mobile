#!/usr/bin/env sh
set -u

while :; do
  pnpm exec expo start --web -c --max-workers 1 --port "${EXPO_PORT:-8081}"
  status=$?
  printf '%s\n' "Expo Web exited with status ${status}; restarting Metro..." >&2
  sleep 1
done
