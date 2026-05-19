#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GRAPH_STUDIO_DEPLOY_KEY:-}" ]; then
  echo "GRAPH_STUDIO_DEPLOY_KEY is required"
  exit 1
fi

# Strip CR/LF/spaces (common when pasting from Studio or Windows .env files)
GRAPH_STUDIO_DEPLOY_KEY="$(printf '%s' "$GRAPH_STUDIO_DEPLOY_KEY" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [ -z "$GRAPH_STUDIO_DEPLOY_KEY" ]; then
  echo "GRAPH_STUDIO_DEPLOY_KEY is empty after trimming"
  exit 1
fi

KEY_LEN="${#GRAPH_STUDIO_DEPLOY_KEY}"
echo "Deploy key length: $KEY_LEN (Subgraph Studio keys are usually 32 hex chars)"

VERSION_LABEL="${VERSION_LABEL:-v0.0.1}"
# Must match the subgraph slug in Subgraph Studio (often "account/creative-platform").
# If deploy fails with "Deploy key not found", the slug is often wrong — copy it from Studio → Deploy.
SUBGRAPH_SLUG="${GRAPH_STUDIO_SUBGRAPH_SLUG:-creative-platform}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT/subgraphs/creative-platform"

pnpm install
pnpm exec graph auth "$GRAPH_STUDIO_DEPLOY_KEY"
pnpm exec graph codegen
pnpm exec graph build
# Use deploy key from ~/.graph-cli.json (written by graph auth) to avoid header/env mismatch.
pnpm exec graph deploy "$SUBGRAPH_SLUG" subgraph.yaml --version-label "$VERSION_LABEL"

echo "Deployed $SUBGRAPH_SLUG with version label: $VERSION_LABEL"
