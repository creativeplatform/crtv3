# Campaign Stickers (Base)

Permissionless ERC-1155 stickers for Snapshot campaign voters.

## Deploy

```bash
# Compile & test
forge test --match-contract CampaignStickersTest -vv

# Deploy to Base
forge script script/DeployCampaignStickers.s.sol:DeployCampaignStickers \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Set `NEXT_PUBLIC_CAMPAIGN_STICKERS_ADDRESS` to the deployed address.

## Env

See `env.example`:

- `NEXT_PUBLIC_CAMPAIGN_STICKERS_ADDRESS`
- `NEXT_PUBLIC_STICKER_VERIFIER_ADDRESS` / `STICKER_VERIFIER_PRIVATE_KEY`
- Grove uses the existing Lens Chain storage configuration.
- `FILEVERSE_API_KEY` (HeartBit unsigned mint)

## Note on CreatorIP contracts

`foundry.toml` skips `*/CreatorIP*` during `forge test` because those thirdweb-based contracts need a matching OpenZeppelin upgradeable stack. Source files remain under `contracts/` for Story Protocol work.
