# CRTV v4 - Decentralized Video Platform

CRTV v4 is a modern, decentralized video platform built with Next.js that combines Web3 technologies to provide a secure, permissionless, and feature-rich experience for creators and viewers.

![Creative Banner](public/images/creative-banner.png)

## 🏗️ Architecture Overview

CRTV4 is built on a modular architecture that integrates several key technologies:

### Core Technologies

- **Next.js**: Full-stack React framework with server components and routing
- **TypeScript**: For type-safe development
- **Tailwind CSS**: For responsive and consistent styling
- **shadcn/ui**: For UI components built on Radix UI primitives

### Web3 Stack

- **Account Kit by Alchemy**: For account abstraction, simplified onboarding, and wallet interactions
- **Livepeer**: For decentralized video streaming infrastructure with token-gating capabilities
- **Viem & Wagmi**: For Ethereum interactions and hooks

## 📚 Key Features

- **Smart Accounts**: Account abstraction for improved UX and transaction management
- **Decentralized Video Hosting**: Leveraging Livepeer for reliable, censorship-resistant video content
- **Token-Gated Content**: Access control for premium content using NFTs
- **Livepeer AI Integration**: Video translation, transcription, and generation features
- **Leaderboard**: Track top creators and content
- **Multi-chain Support**: Built with cross-chain compatibility in mind

## 🔍 Directory Structure

```
app/                  # Next.js app directory with file-based routing
  api/                # API routes and server actions
    auth/             # Authentication endpoints
    livepeer/         # Livepeer integration endpoints
      - AI actions    # Video AI features (transcription, translation, etc.)
      - token-gate    # Token-gated video access control
  leaderboard/        # Leaderboard page
  send/               # Transaction sending page
components/           # React components
  ui/                 # UI components from shadcn/ui
  Player/             # Video player components
  wallet/             # Wallet-related components
context/              # React context providers
  LitContext.tsx      # Lit Protocol context
  VideoContext.tsx    # Video-related context
lib/                  # Utility functions and SDK integrations
  hooks/              # Custom React hooks
    accountkit/       # Account Kit hooks
    livepeer/         # Livepeer hooks
  sdk/                # SDK integrations
    livepeer/         # Livepeer SDK setup
    accountKit/       # Account Kit SDK setup
  utils/              # Utility functions
public/               # Static assets
```

## 📐 System Architecture

### Authentication Flow

1. **User Onboarding**:

   - Users can authenticate with or without a traditional wallet

2. **Session Management**:

   - Session signatures allow for persistent authentication
   - Smart account capabilities for seamless transactions

3. **Access Control**:
   - Token-gated content using NFTs and Livepeer's webhook system
   - Role-based permissions for creators and viewers

### Video Processing Pipeline

1. **Upload**:

   - Videos are uploaded to Livepeer's decentralized network
   - Metadata is stored with creator information and access controls

2. **Processing**:

   - Transcoding for optimal playback across devices
   - Optional AI processing for transcription, translation, or enhancement

3. **Delivery**:

   - Content delivered through Livepeer's CDN
   - Token-gating verification for protected content

4. **Analytics**:
   - View tracking and engagement metrics
   - Creator dashboard with performance insights

## 🔗 Account Kit & Lit Protocol Integration

CRTV4 features a sophisticated integration between Alchemy's Account Kit and Lit Protocol to provide a seamless, secure user experience:

### Integration Overview

The platform combines Account Kit's smart account capabilities with Lit Protocol's authentication and programmable key pairs (PKPs) to create a powerful user experience:

1. **Account Kit** provides:

   - Smart Contract Accounts (SCAs) using ERC-4337 account abstraction
   - Multi-chain transaction management
   - Simplified user onboarding with social logins
   - Bundled transaction support
   - Gas sponsorship capabilities
   - Session signatures for persistent authentication
   - Wallet-less authentication options

### Authentication Flow

The authentication process follows these steps:

1. User connects with Account Kit (social login, passkey, etc.)
2. For SCA users, a wallet address is minted via Account Kit
3. Session signatures are obtained for persistent authentication
4. The Smart Account handles blockchain transactions

### Technical Implementation

The codebase implements this integration through:

- **Smart Account Hook** (`useModularAccount`): Manages ModularAccountV2 instances from Account Kit
- **Session Management** (`useSessionSigs`): Handles authentication with Accoun Kit
- **Unified Signer** (`useUnifiedSessionSigner`): Combines different authentication approaches

### Key Technical Challenges

1. **Authentication Method Compatibility**:

   - Smart Contract Accounts cannot directly sign messages in the ECDSA format.
   - The solution uses EOA signatures for Account Kit authentication while leveraging SCA for transactions

2. **Session Management**:

   - Session signatures expire and require refresh logic
   - The application implements debouncing and retry mechanisms

3. **Cross-System Identity**:
   - PKPs serve as the bridge between traditional authentication and blockchain operations
   - The system maintains consistent identity across both ecosystems

This integration enables CRTV4 to provide features like wallet-less authentication, seamless transaction experiences, and a unified user identity across both centralized and decentralized components.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and yarn/npm
- An Alchemy API key
- A Livepeer API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/crtv4.git
cd crtv4
```

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:

Copy **`.env.example`** to `.env.local` and fill in values (see **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** for how to obtain each). For Vercel deploys, set the same variables in Project → Settings → Environment Variables. To use values from Vercel locally, run `vercel env pull` in the project root (requires [Vercel CLI](https://vercel.com/docs/cli) and `vercel link`).

- `NEXT_PUBLIC_ALCHEMY_API_KEY` - Your Alchemy API key
- `NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID` - Your Gas Manager policy ID  
- `LIVEPEER_API_KEY` - Your Livepeer API key
- `LIVEPEER_WEBHOOK_ID` - Your Livepeer webhook ID
- `NEXT_PUBLIC_AXIOM_INGEST_ENDPOINT` - Your Axiom ingest endpoint (optional, for full-stack observability)
- And other required variables

**Quick start:** See the [Environment Variables Setup Guide](./ENVIRONMENT_SETUP.md) for step-by-step instructions.

4. Run the development server:

```bash
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Configuration

The application is configured through environment variables and the `config/index.ts` file. This ensures type-safe configuration with Zod validation.

## 📊 Observability & Logging

This application uses **next-axiom** for full-stack observability with Axiom. Logs and events can be sent from any part of the Next.js application - client, edge, or server-side.

### Setup

1. **Link Vercel Project to Axiom** (if deploying on Vercel):
   - Automatic log flow from Vercel to Axiom when project is linked
   - Logs will automatically start flowing once linked

2. **Environment Variable**:
   - Set `NEXT_PUBLIC_AXIOM_INGEST_ENDPOINT` to your Axiom ingest endpoint URL
   - This endpoint is provided by Axiom after linking your project
   - Get the endpoint URL from your Axiom dashboard

3. **Usage**:
   ```typescript
   // Client components, API routes, server components, edge functions
   import { log } from 'next-axiom';
   
   log.debug('debug message', { customerId: 123, auth: 'session' });
   log.info('info message', { playbackId: 'abc123', userId: 'xyz' });
   log.error('error message', { endpoint: '/api/livepeer', status: 500 });
   ```

### Web Vitals

Web Vitals are automatically reported to Axiom via the `WebVitals` client component. This tracks Core Web Vitals metrics (LCP, FID, FCP, CLS, TTFB, INP) for performance monitoring. The component is automatically included in the root layout.

## 🌐 Deployment

This application can be deployed on Vercel or any other Next.js-compatible hosting service. When deploying on Vercel, you can link your project to Axiom for automatic log collection.

## 📚 Additional Resources

### Engineering docs

- [Platform API](./docs/platform-api.md) — tiered playback resolver and x402 gating
- [Predictions](./docs/predictions.md) — Reality.eth markets, quotas, display enrichment, API routes
- [Live stream MeToken gate](./docs/live-stream-metoken-gate.md) — gated live playback, JWT auth, linked-wallet balance checks

### External

- [Account Kit Documentation](https://accountkit.alchemy.com/)
- [Livepeer Documentation](https://docs.livepeer.org/)
- [Next.js Documentation](https://nextjs.org/docs)

## 📝 License

This project is licensed under the terms of the license included in the repository.
