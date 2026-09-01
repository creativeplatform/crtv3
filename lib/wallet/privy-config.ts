import {
  createWalletCreationOnLoginPlugin,
  type PrivyClientConfig,
  type User,
} from "@privy-io/react-auth";

const walletCreationPluginOptions = {
  shouldCreateWallet: ({ user }: { user: User }) =>
    user.customMetadata?.["alchemy_org_id"] === undefined,
};

export function getPrivyConfig(): PrivyClientConfig {
  return {
    loginMethods: ["email", "google", "passkey", "twitch"],
    appearance: {
      theme: "dark",
      accentColor: "#676FFF",
    },
    plugins: [createWalletCreationOnLoginPlugin(walletCreationPluginOptions)],
    embeddedWallets: {
      ethereum: {
        createOnLogin: "users-without-wallets",
      },
    },
  };
}
