// Creative TV only uses the EVM path from @alchemy/wallet-apis.
// The package imports its Solana decorator unconditionally, which pulls @solana/kit
// into the Next.js bundle and can fail when other dependencies install a different
// Solana package major. This stub keeps the EVM client path buildable.
export const solanaSmartWalletActions = () => ({});
