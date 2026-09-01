# MeTokens Integration Setup

This document explains how to set up the MeTokens integration in your application.

## CORS Issue Resolution

The MeTokens subgraph endpoint has CORS restrictions that prevent direct access from browser applications. To resolve this, we've implemented a server-side API proxy.

## Setup Instructions

### 1. Subgraph Configuration

The app uses **Graph Studio** as the primary subgraph (`GRAPH_STUDIO_CREATIVE_PLATFORM_URL`, deploy tag **1.0.3**). **Goldsky** `metokens/1.0.3` is the fallback when `SUBGRAPH_PROVIDER_MODE=goldsky` or Studio is unset.

**Goldsky fallback endpoint:**
- **MeTokens**: `https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/metokens/1.0.3/gn`
  - Deployment ID: `QmVaWYhk4HKhk9rNQi11RKujTVS4KHF1uHGNVUF4f7xJ53`
- **Creative TV**: `https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/creative_tv/0.1/gn`
  - Deployment ID: `QmbDp8Wfy82g8L7Mv6RCAZHRcYUQB4prQfqchvexfZR8yZ`

**Note:** No environment variables are required for basic subgraph access since these are public Goldsky endpoints.

### 2. API Proxy

The application includes an API proxy route at `/api/metokens-subgraph` that:
- Handles CORS issues by making server-side requests
- Forwards GraphQL queries to the Goldsky MeTokens subgraph (primary)
- Provides better error handling and logging

### 3. Testing the Integration

To test if the MeTokens integration is working:

1. Start your development server: `yarn dev`
2. Add the `MeTokensTest` component to any page to verify the connection

```tsx
import MeTokensTest from '@/components/UserProfile/MeTokensTest';

// Add this to your page
<MeTokensTest />
```

### 4. MeTokens Subgraph Endpoints

The subgraph endpoints are now using **Goldsky** public APIs:

**MeTokens Subgraph:**
```
https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/metokens/1.0.3/gn
```

**Creative TV Subgraph:**
```
https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/creative_tv/0.1/gn
```

These are public endpoints and don't require authentication.

### 5. Available Queries

The MeTokens subgraph client supports:
- `getAllMeTokens()` - Get all MeTokens
- `getMeTokensByOwner(owner)` - Get MeTokens by owner address
- `getMeToken(id)` - Get specific MeToken by ID
- `getHub(id)` - Get hub information
- `getRecentMints()` - Get recent mint events
- `getRecentBurns()` - Get recent burn events

### 6. Error Handling

If you encounter errors:
1. Verify the Goldsky subgraph endpoint is accessible
2. Check your internet connection
3. Check the browser console and server logs for detailed error messages
4. Look for rate limiting issues (HTTP 429 responses)

### 7. Contract Addresses (Base)

- MeTokenFactory: `0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B`
- Diamond: `0xba5502db2aC2cBff189965e991C07109B14eB3f5`

## Troubleshooting

### CORS Errors
If you still see CORS errors, ensure:
1. The API proxy is working correctly at `/api/metokens-subgraph`
2. Your development server is running
3. Check browser console for specific CORS error messages

### Rate Limiting
If you get rate limiting errors (429):
1. Goldsky public endpoints have rate limits
2. Implement request throttling in your application
3. Consider caching responses when appropriate
4. Contact Goldsky for higher rate limits if needed

### Network Errors
If you get network errors:
1. Check your internet connection
2. Verify the Goldsky endpoint is accessible
3. Check if there are any firewall restrictions
4. Monitor Goldsky status at their status page
5. Contact support if Goldsky is down


