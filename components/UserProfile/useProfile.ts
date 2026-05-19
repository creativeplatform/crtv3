import { useEffect, useReducer } from "react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import type { Account } from "@/lib/types/account";
import { baseMainnet } from "@/lib/utils/chains/base";
import { formatAddress, stack } from "@/lib/sdk/stack/stackClient";
import Unlock from "@/lib/contracts/Unlock.json";
import { toast } from "sonner";
import type { ProfileState } from "../../lib/types/profile";
import { logger } from '@/lib/utils/logger';


const contractAddress = "0xf7c4cd399395d80f9d61fde833849106775269c6";

type ProfileAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_MEMBER_DATA"; payload: Account }
  | { type: "SET_NFT_DATA"; payload: any }
  | { type: "SET_BALANCE"; payload: string }
  | { type: "SET_POINTS"; payload: number }
  | { type: "SET_OWNED_IDS"; payload: bigint[] }
  | { type: "SET_VALID_KEY"; payload: boolean };

const initialState: ProfileState = {
  memberData: null,
  nftData: null,
  balance: "0",
  points: 0,
  ownedIds: [],
  isLoading: false,
  hasValidKey: false,
};

function profileReducer(
  state: ProfileState,
  action: ProfileAction
): ProfileState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_MEMBER_DATA":
      return { ...state, memberData: action.payload };
    case "SET_NFT_DATA":
      return { ...state, nftData: action.payload };
    case "SET_BALANCE":
      return { ...state, balance: action.payload };
    case "SET_POINTS":
      return { ...state, points: action.payload };
    case "SET_OWNED_IDS":
      return { ...state, ownedIds: action.payload };
    case "SET_VALID_KEY":
      return { ...state, hasValidKey: action.payload };
    default:
      return state;
  }
}

export function useProfile(account: Account | null) {
  const [state, dispatch] = useReducer(profileReducer, initialState);

  const publicClient = createPublicClient({
    chain: baseMainnet,
    transport: http(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    ),
  });

  const walletClient =
    typeof window !== "undefined"
      ? createWalletClient({
          chain: baseMainnet,
          transport: custom(window.ethereum),
        })
      : null;

  useEffect(() => {
    async function fetchHasValidKey() {
      if (!account?.address) return;
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const hasKey = await publicClient.readContract({
          address: contractAddress,
          abi: Unlock.abi,
          functionName: "getHasValidKey",
          args: [account.address],
        });
        dispatch({ type: "SET_VALID_KEY", payload: hasKey as boolean });
      } catch (error) {
        logger.error("Error reading contract:", error);
        toast.error("Failed to check membership status");
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    fetchHasValidKey();
  }, [account, publicClient]);

  useEffect(() => {
    const fetchPoints = async () => {
      if (!account?.address) return;
      try {
        const formattedAddress = formatAddress(account);
        const userPoints = await stack.getPoints(formattedAddress);
        dispatch({ type: "SET_POINTS", payload: Number(userPoints) });
        dispatch({ type: "SET_BALANCE", payload: userPoints.toString() });
      } catch (error) {
        logger.error("Error fetching points:", error);
        toast.error("Failed to fetch points");
        dispatch({ type: "SET_BALANCE", payload: "0" });
      }
    };
    fetchPoints();
  }, [account]);

  useEffect(() => {
    const fetchNFTData = async () => {
      if (!account?.address) return;
      try {
        const ownedTokenIds = (await publicClient.readContract({
          address: contractAddress,
          abi: Unlock.abi,
          functionName: "balanceOf",
          args: [account.address],
        })) as bigint;

        const tokenIds: bigint[] = [];
        for (let i = 0n; i < ownedTokenIds; i++) {
          const tokenId = (await publicClient.readContract({
            address: contractAddress,
            abi: Unlock.abi,
            functionName: "tokenOfOwnerByIndex",
            args: [account.address, i],
          })) as bigint;
          tokenIds.push(tokenId);
        }

        dispatch({ type: "SET_OWNED_IDS", payload: tokenIds });

        if (tokenIds.length > 0) {
          const metadata = await publicClient.readContract({
            address: contractAddress,
            abi: Unlock.abi,
            functionName: "tokenURI",
            args: [tokenIds[0]],
          });
          dispatch({ type: "SET_NFT_DATA", payload: metadata });
        }

        dispatch({ type: "SET_MEMBER_DATA", payload: account });
      } catch (error) {
        logger.error("Error fetching NFT data:", error);
        toast.error("Failed to fetch NFT data");
      }
    };
    fetchNFTData();
  }, [account, publicClient]);

  const handleRenewMembership = async () => {
    if (!walletClient || !account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      // Implement renewal logic
      toast.success("Membership renewed successfully");
    } catch (error) {
      logger.error("Error renewing membership:", error);
      toast.error("Failed to renew membership");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleCancelMembership = async () => {
    if (!walletClient || !account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      // Implement cancellation logic
      toast.success("Membership cancelled successfully");
    } catch (error) {
      logger.error("Error cancelling membership:", error);
      toast.error("Failed to cancel membership");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  return {
    ...state,
    handleRenewMembership,
    handleCancelMembership,
  };
}
