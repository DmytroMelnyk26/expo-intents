#!/usr/bin/env bash

set -eo pipefail

EXPO_INTENTS_PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

# `$PROJECT_DIR` is passed by Xcode as the directory of the xcodeproj being built. Only run
# from the Pods project to avoid building the bundle twice (the main project also links the pod).
PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")
if [ "x$PROJECT_DIR_BASENAME" != "xPods" ]; then
  exit 0
fi

# If PROJECT_ROOT is not specified, fall back to the Xcode PROJECT_DIR.
PROJECT_ROOT=${PROJECT_ROOT:-"$PROJECT_DIR/../.."}
PROJECT_ROOT=${PROJECT_ROOT:-"$EXPO_INTENTS_PACKAGE_DIR/../.."}

cd "$PROJECT_ROOT" || exit

"${EXPO_INTENTS_PACKAGE_DIR}/scripts/with-node.sh" "${EXPO_INTENTS_PACKAGE_DIR}/scripts/build-bundle.mjs" "$PROJECT_ROOT"
