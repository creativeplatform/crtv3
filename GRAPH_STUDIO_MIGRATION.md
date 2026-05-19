# Graph Studio Migration Runbook

This runbook migrates from Goldsky (`metokens` + `reality-eth`) to one merged Graph Studio subgraph: `creative-platform`.

## 1) Prepare and Deploy

1. In [Subgraph Studio](https://thegraph.com/studio/), open your subgraph → **Settings** → copy the **Deploy key** (32 hex chars).
2. Set in `.env.local`: `GRAPH_STUDIO_DEPLOY_KEY=...`  
   If the Studio slug is not exactly `creative-platform`, set `GRAPH_STUDIO_SUBGRAPH_SLUG=youraccount/creative-platform`.
3. Deploy (uses `@graphprotocol/graph-cli` ≥ 0.98; default node is Studio):
   - `VERSION_LABEL=v0.0.1 ./scripts/graph-studio/deploy-creative-platform.sh`  
   Or from `subgraphs/creative-platform`:  
   `pnpm exec graph deploy "$GRAPH_STUDIO_SUBGRAPH_SLUG" subgraph.yaml --version-label v0.0.1 --deploy-key "$GRAPH_STUDIO_DEPLOY_KEY"`
4. If the API returns **“Deploy key not found”** after `graph auth` succeeds, it is often a **wrong subgraph slug** (not a bad key). In Studio open **Deploy** and copy the subgraph name exactly (e.g. `myaccount/creative-platform`), then set `GRAPH_STUDIO_SUBGRAPH_SLUG` to that value and re-run the script. Also rotate the deploy key in **Settings** if unsure.
5. In Graph Studio, copy the query endpoint and set:
   - `GRAPH_STUDIO_CREATIVE_PLATFORM_URL=...`

## 2) Parity Validation

Set:
- `GOLDSKY_METOKENS_URL=https://api.goldsky.com/api/public/<project>/subgraphs/metokens/1.0.2/gn`
- `GOLDSKY_REALITY_ETH_URL=https://api.goldsky.com/api/public/<project>/subgraphs/reality-eth/1.0.0/gn`
- `GRAPH_STUDIO_CREATIVE_PLATFORM_URL=<studio-query-url>`

Run:
- `tsx scripts/graph-studio/parity-check.ts`

## 3) Cutover

1. Safe mode (recommended first):
   - `SUBGRAPH_PROVIDER_MODE=dual`
2. Full cutover:
   - `SUBGRAPH_PROVIDER_MODE=studio`
3. Rollback:
   - `SUBGRAPH_PROVIDER_MODE=goldsky`

## 4) Post-Cutover Cleanup

- Remove old Goldsky-only assumptions in docs/runbooks.
- Keep Goldsky endpoints available temporarily as emergency rollback.
