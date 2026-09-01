import type { User as BaseUser } from "@account-kit/signer";
import { type Account as ViemAccount } from "viem";
import type { CompatUser } from "@/lib/wallet/react";

type User = (BaseUser & { type: "eoa" | "sca" }) | CompatUser;

export interface Account {
  address: string;
  type: "eoa" | "sca";
}

export function userToAccount(user: User | CompatUser | null): Account | null {
  if (!user) return null;

  return {
    address: user.address,
    type: user.type,
  };
}

export function viemToAccount(account: ViemAccount): Account {
  return {
    address: account.address,
    type: "eoa",
  };
}
