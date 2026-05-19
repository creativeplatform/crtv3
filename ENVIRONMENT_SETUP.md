# Environment Variables Setup Guide

This guide will help you set up the required environment variables for your application. The canonical list of variable names is in **`.env.example`** at the project root—copy it to `.env.local` and fill in values for local development.

## Deploying on Vercel

On Vercel, environment variables are set in the project, not in a file. No `.env` file is read at build or runtime.

1. **Add variables:** In the [Vercel Dashboard](https://vercel.com/dashboard), open your project → **Settings** → **Environment Variables**. Add every variable your app needs, using the **exact names** from `.env.example`. Assign them to the right environments (Production, Preview, Development).
2. **Public vs secret:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser; all others are server-only. Do not put secrets in `NEXT_PUBLIC_` vars.
3. **Local dev from Vercel:** To populate `.env.local` from the variables already set on Vercel, run `vercel env pull` in the project root (requires [Vercel CLI](https://vercel.com/docs/cli)). This creates or updates `.env.local`, which is gitignored and will not be committed.

## Required Environment Variables

### 1. Alchemy Configuration

#### `NEXT_PUBLIC_ALCHEMY_API_KEY`
Your Alchemy API key for blockchain interactions and smart account functionality.

**How to get it:**
1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Log in or create an account
3. Create a new app or select an existing one:
   - Click "Create new app"
   - Select "Base" as the chain
   - Choose "Base Mainnet" as the network
4. Copy the API key from your app dashboard

**Documentation:** [How to Create Access Keys](https://docs.alchemy.com/docs/how-to-create-access-keys)

#### `NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID`
Your Alchemy Gas Manager policy ID for sponsoring user transaction fees.

**How to get it:**
1. Go to [Alchemy Gas Manager](https://dashboard.alchemy.com/gas-manager)
2. Click "Create new policy"
3. Configure your policy:
   - Set spending rules (daily/monthly limits)
   - Configure which operations to sponsor
   - Add allowlists if needed
4. Copy the Policy ID after creation

**Documentation:** [Gas Manager Services](https://docs.alchemy.com/docs/gas-manager-services)

#### Story Protocol (Alchemy)

Alchemy supports **Story mainnet** (network ID **1514**) for RPC and gas sponsorship:

- **RPC:** Use `https://story-mainnet.g.alchemy.com/v2/{apiKey}` by setting `NEXT_PUBLIC_STORY_ALCHEMY_API_KEY` (same key can be used for Base and Story, or use a separate key). For testnet (Aeneid), the app uses `https://story-testnet.g.alchemy.com/v2/{apiKey}` when the same env var is set.
- **Gas sponsorship:** Create a Gas Manager policy for **Story** in the [Alchemy Gas Manager](https://dashboard.alchemy.com/gas-manager) (select Story mainnet and/or Aeneid testnet), then set `NEXT_PUBLIC_STORY_POLICY_ID`. When sending UserOperations on Story chain, the app uses this policy so gas can be sponsored without a funding wallet.

**Documentation:** [Story API Overview](https://www.alchemy.com/docs/chains/story/story-api-endpoints/net-version) · [Story API Quickstart](https://www.alchemy.com/docs/reference/story-api-quickstart)

### 2. Livepeer Configuration

#### `LIVEPEER_API_KEY`
Your Livepeer API key for video streaming and processing.

**How to get it:**
1. Go to [Livepeer Studio](https://livepeer.studio/dashboard/developers/api-keys)
2. Create a new API key
3. Copy the key

#### `LIVEPEER_WEBHOOK_ID`
Your Livepeer webhook ID for video processing callbacks.

**How to get it:**
1. In Livepeer Studio, go to Webhooks
2. Create a new webhook pointing to your application URL
3. Copy the webhook ID

### 3. Supabase Configuration

#### `NEXT_PUBLIC_SUPABASE_URL`
Your Supabase project URL.

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Your Supabase anonymous/public key.

#### `SUPABASE_SERVICE_ROLE_KEY`
Your Supabase service role key (server-side only).

**How to get them:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy the URL and keys

### 4. Subgraph Configuration (Goldsky + Graph Studio)

The application supports Goldsky and Graph Studio for blockchain indexing:

#### MeTokens Subgraphs (Existing Project)
No configuration is required as these are public endpoints:

- **MeTokens Subgraph (Primary - Goldsky)**: `https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/metokens/1.0.2/gn`
  - Deployment ID: `QmVaWYhk4HKhk9rNQi11RKujTVS4KHF1uHGNVUF4f7xJ53`

- **Creative TV Subgraph**: `https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/creative_tv/0.1/gn`
  - Deployment ID: `QmbDp8Wfy82g8L7Mv6RCAZHRcYUQB4prQfqchvexfZR8yZ`

**Note:** These endpoints are accessed via the API proxy at `/api/metokens-subgraph` to handle CORS.

#### Reality.eth Subgraph

**Public Endpoint:**
- **Reality.eth Subgraph**: `https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/reality-eth/1.0.0/gn`
- Uses the same Goldsky project as MeTokens subgraphs by default

**`GOLDSKY_REALITY_ETH_PROJECT_ID`** (Optional)
- Project ID for the Reality.eth subgraph if you want to use a separate project
- If not set, will use the MeTokens project ID (`project_cmh0iv6s500dbw2p22vsxcfo6`)
- Set this environment variable only if you want to use a different Goldsky project

**Note:** The Reality.eth subgraph endpoint is accessed via `/api/reality-eth-subgraph` to handle CORS.

#### Graph Studio (Merged Creative Platform Subgraph)

`SUBGRAPH_PROVIDER_MODE` (Optional)
- Supported values: `goldsky` (default), `studio`, `dual`
- `dual` attempts Graph Studio first, then falls back to Goldsky

`GRAPH_STUDIO_CREATIVE_PLATFORM_URL` (Required for `studio` or `dual`)
- Full GraphQL query URL for your Graph Studio deployment
- Example format: `https://gateway.thegraph.com/api/<query-key>/subgraphs/id/<deployment-id>`

`GRAPH_STUDIO_DEPLOY_KEY` (Deployment only)
- Used by `scripts/graph-studio/deploy-creative-platform.sh`
- Keep server-side only

### 5. Coinbase CDP Configuration (Onramp/Offramp)

#### `COINBASE_CDP_API_KEY_ID`
Your Coinbase Developer Platform (CDP) API Key ID for generating session tokens.

#### `COINBASE_CDP_API_KEY_SECRET`
Your Coinbase Developer Platform (CDP) Secret API Key for JWT authentication.

**How to get them:**
1. Go to [Coinbase Developer Platform Portal](https://portal.cdp.coinbase.com/)
2. Log in or create an account
3. Create a new project or select an existing one
4. Navigate to **API Keys** tab
5. Select **Secret API Keys** section
6. Click **Create API key**
7. Configure your key settings (IP allowlist recommended for security)
8. Download and securely store your API key
   - The API Key ID is displayed in the portal
   - The Secret API Key is only shown once during creation - save it securely

**Important Notes:**
- These keys are required for Coinbase Onramp/Offramp integration
- Session tokens are generated server-side using these credentials
- The Secret API Key must never be exposed to the client
- Session tokens expire after 5 minutes and are single-use

**Documentation:**
- [CDP API Key Authentication](https://docs.cdp.coinbase.com/api-reference/v2/authentication)
- [Session Token Authentication](https://docs.cdp.coinbase.com/onramp-&-offramp/session-token-authentication)

### 6. Story Protocol Configuration (Optional)

#### `NEXT_PUBLIC_STORY_RPC_URL`
RPC URL for Story Protocol network. Defaults to testnet RPC if not provided.

**Default values:**
- Testnet (Aeneid): `https://rpc.aeneid.story.foundation`
- Mainnet: `https://rpc.story.foundation` (when mainnet is available)

#### `NEXT_PUBLIC_STORY_NETWORK`
Story Protocol network to use. Set to `"testnet"` for Aeneid testnet or `"mainnet"` for mainnet.

**Default:** `"testnet"`

#### `NEXT_PUBLIC_STORY_ALCHEMY_API_KEY` (Optional)
Alchemy API key for Story Protocol testnet. If provided, uses Alchemy's RPC endpoint for better reliability.

**How to get it:**
1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create a new app or select an existing one
3. Select "Story" as the chain (or use custom RPC)
4. Copy the API key

**Note:** If not provided, the public Story Protocol RPC will be used.

**How to configure:**
1. For testnet (recommended for development):
   ```bash
   NEXT_PUBLIC_STORY_NETWORK=testnet
   NEXT_PUBLIC_STORY_RPC_URL=https://rpc.aeneid.story.foundation
   # Optional: Use Alchemy for better reliability
   NEXT_PUBLIC_STORY_ALCHEMY_API_KEY=your_story_alchemy_key
   ```

2. For mainnet (production):
   ```bash
   NEXT_PUBLIC_STORY_NETWORK=mainnet
   NEXT_PUBLIC_STORY_RPC_URL=https://rpc.story.foundation
   # Optional: Use Alchemy for better reliability
   NEXT_PUBLIC_STORY_ALCHEMY_API_KEY=your_story_alchemy_key
   ```

**Note:** Story Protocol now supports mint-and-register functionality via SPG (Story Protocol Gateway). When enabled, videos are automatically minted as NFTs and registered as IP Assets on Story Protocol in a single transaction. Each creator gets their own NFT collection address for true ownership and branding.

#### `NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS` (Optional)
Address of the deployed CreatorIPCollectionFactory contract on Story Protocol. If provided, the system will use the factory to deploy creator-owned collections instead of using SPG directly.

**How to get it:**
1. Deploy the factory contract using the deployment script (see `contracts/DEPLOY_FACTORY_GUIDE.md`)
2. Copy the factory address from the deployment output

**Note:** If not provided, the system will fallback to using Story Protocol SPG for collection creation.

#### `NEXT_PUBLIC_STORY_POLICY_ID` (Optional)
Alchemy Gas Manager policy ID for Story Protocol (chain IDs 1315 testnet / 1514 mainnet). When set and when Story transactions are sent as UserOperations (e.g. client-signed creator-as-deployer flow), Alchemy sponsors gas so you do **not** need `STORY_PROTOCOL_PRIVATE_KEY` to pay for Story deploy/interactions.

**How to get it:**
1. Go to [Alchemy Gas Manager](https://dashboard.alchemy.com/gas-manager)
2. Create a new policy and select **Story** (Aeneid testnet and/or Story mainnet)
3. Configure spending rules and copy the Policy ID

**Note:** This works when the Story tx is sent as a UserOp (e.g. via the prepare-mint flow and client-side signing on Story chain). If you use the server-side mint flow with `STORY_PROTOCOL_PRIVATE_KEY`, that wallet pays gas; set `NEXT_PUBLIC_STORY_POLICY_ID` to have Alchemy sponsor gas when using the creator-sign flow instead.

#### `STORY_PROTOCOL_PRIVATE_KEY` (Optional, Server-side only)
Private key for a wallet that will fund Story Protocol transactions (minting NFTs, IP registration, etc.). This wallet must have IP tokens for gas fees on Story Protocol. If you use `NEXT_PUBLIC_STORY_POLICY_ID` with the creator-sign (UserOp) flow, you can avoid setting this.

**NFT minting step:** The upload flow checks `/api/story/mint-configured`. When `STORY_PROTOCOL_PRIVATE_KEY` is not set, the NFT minting step shows "NFT minting unavailable" instead of the mint UI. Set this variable to enable the step.

**Important:**
- This is a **funding wallet** - it pays for gas fees but doesn't need to match the creator's address
- The wallet must have IP tokens on Story Protocol (testnet or mainnet depending on your configuration)
- This is a sensitive credential - never commit to version control
- For production, use a dedicated service wallet with limited funds

**How to get IP tokens:**
1. Get the funding wallet address by calling `/api/story/funding-wallet` (after setting the private key)
2. Transfer IP tokens to that address using Story Protocol's testnet faucet or mainnet bridge
3. For testnet: Use the Aeneid testnet faucet to get IP tokens

**Warning:** This is a sensitive credential. Never commit this to version control. Use environment variables and secure key management in production.

#### `FACTORY_OWNER_PRIVATE_KEY` (Optional, Server-side only)
Private key of the factory owner account. Required for factory-based collection deployments. This must be kept secure and should only be used server-side.

**Warning:** This is a sensitive credential. Never commit this to version control. Use environment variables and secure key management in production.

#### `COLLECTION_BYTECODE` (Optional, Server-side only)
Creation bytecode of the TokenERC721 contract. This is required for factory deployments. The bytecode should match the bytecode hash stored in the factory contract.

**How to get it:**
1. Compile the TokenERC721 contract (from `contracts/CreatorIPCollection.sol`) using Foundry
2. Extract the bytecode from the compiled output: `out/CreatorIPCollection.sol/TokenERC721.json`
3. Copy the `bytecode.object` field

**Note:** The factory contract validates that the bytecode hash matches the stored hash, so ensure the bytecode is correct.

**Documentation:**
- [Story Protocol Documentation](https://docs.story.foundation/)
- [Story Protocol SDK](https://github.com/storyprotocol/core-sdk)
- [Aeneid Testnet Guide](https://docs.story.foundation/developer-guides/testnet-setup)
- [SPG (Story Protocol Gateway)](https://docs.story.foundation/concepts/spg/overview.md)
- [Factory Deployment Guide](./contracts/DEPLOY_FACTORY_GUIDE.md)

### 7. Optional Configuration

#### `NEXT_PUBLIC_SUPPORT_URL`
Your application's support URL.

## Setup Instructions

### For Development

1. Create a `.env.local` file in the root directory:

```bash
touch .env.local
```

2. Add the following variables to `.env.local`:

```bash
# Alchemy Configuration
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID=your_gas_manager_policy_id_here

# Livepeer Configuration
LIVEPEER_API_KEY=your_livepeer_api_key
LIVEPEER_WEBHOOK_ID=your_livepeer_webhook_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Coinbase CDP Configuration (Onramp/Offramp)
COINBASE_CDP_API_KEY_ID=your_cdp_api_key_id
COINBASE_CDP_API_KEY_SECRET=your_cdp_api_key_secret

# Story Protocol Configuration (Optional - for IP Asset registration)
NEXT_PUBLIC_STORY_NETWORK=testnet
NEXT_PUBLIC_STORY_RPC_URL=https://rpc.aeneid.story.foundation
# Optional: Use Alchemy for Story Protocol (better reliability)
# NEXT_PUBLIC_STORY_ALCHEMY_API_KEY=your_story_alchemy_key

# Story Protocol Funding Wallet (Required for NFT minting and IP registration)
# This wallet must have IP tokens for gas fees on Story Protocol
# Get IP tokens from testnet faucet or mainnet bridge
STORY_PROTOCOL_PRIVATE_KEY=0x...  # Server-side only - funding wallet private key

# Factory Configuration (Optional - for factory-based collection deployment)
# If provided, uses factory to deploy collections; otherwise falls back to SPG
# NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS=0x...
# FACTORY_OWNER_PRIVATE_KEY=0x...  # Server-side only - factory owner's private key
# COLLECTION_BYTECODE=0x...  # Server-side only - TokenERC721 creation bytecode

# NFT Contract Configuration (Optional - for NFT minting in upload flow)
# Set this to your ERC-721 NFT contract address for video asset minting
# This is required if you want to enable NFT minting in the upload flow
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional
NEXT_PUBLIC_SUPPORT_URL=https://your-support-url.com

# Note: SUBGRAPH_QUERY_KEY is no longer needed - now using Goldsky public endpoints
# Optional Graph Studio migration vars
# SUBGRAPH_PROVIDER_MODE=dual
# GRAPH_STUDIO_CREATIVE_PLATFORM_URL=https://gateway.thegraph.com/api/<query-key>/subgraphs/id/<deployment-id>
# GRAPH_STUDIO_DEPLOY_KEY=<deploy-key>
```

3. Replace the placeholder values with your actual keys

4. Start the development server:

```bash
yarn dev
```

### For Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable with its value
4. Redeploy your application

## Security Best Practices

### ✅ DO:
- Use `.env.local` for local development (already in `.gitignore`)
- Store production keys in your deployment platform (Vercel, etc.)
- Rotate keys regularly (recommended: annually)
- Use different API keys for development and production
- Keep service role keys server-side only (no `NEXT_PUBLIC_` prefix)

### ❌ DON'T:
- Commit `.env.local` to version control
- Share keys in public channels
- Use production keys in development
- Hardcode keys in your source code

## Verifying Your Setup

To verify your environment variables are set correctly:

1. Check the API debug endpoint:
```bash
curl http://localhost:3000/api/swap/debug
```

2. Look for:
```json
{
  "hasApiKey": true,
  "hasPolicyId": true,
  "apiKeyPrefix": "your_key_prefix...",
  "policyIdPrefix": "your_policy_id_prefix..."
}
```

## Troubleshooting

### "Alchemy API key not configured" error
- Ensure `NEXT_PUBLIC_ALCHEMY_API_KEY` is set in `.env.local`
- Restart your development server after adding the variable
- Check that the key doesn't have any extra spaces or quotes

### "Alchemy paymaster policy ID not configured" error
- Ensure `NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID` is set in `.env.local`
- Verify the policy is active in your Alchemy Gas Manager dashboard
- Make sure the policy has sufficient funds/limits

### Variables not loading
- Use `.env.example` as the template; copy to `.env.local` and fill in values
- Ensure `.env.local` is in the project root directory
- Restart your development server
- Check that variable names match exactly (case-sensitive)

## Additional Resources

- [Alchemy Documentation](https://docs.alchemy.com/)
- [Account Kit Documentation](https://accountkit.alchemy.com/)
- [Gas Manager Best Practices](https://docs.alchemy.com/docs/gas-manager-services)
- [API Security Best Practices](https://docs.alchemy.com/docs/best-practices-when-using-alchemy)
- [Using API Keys in HTTP Headers](https://docs.alchemy.com/docs/how-to-use-api-keys-in-http-headers)

