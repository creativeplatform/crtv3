import type { Address, PublicClient } from "viem";
import { getAddress, isAddress } from "viem";
import {
  getAnswerHistory,
  getBalanceOf,
  isQuestionFinalized,
  type AnswerHistoryEntry,
} from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { answerBytesToLabel } from "@/lib/predictions/parse-prediction-display";
import type { ParsedPredictionDisplay } from "@/lib/predictions/parse-prediction-display";

export type UserClaimStatus =
  | "not_participant"
  | "bonded_lost"
  | "won_pending_claim"
  | "won_withdrawable"
  | "already_settled";

export type UserClaimStatusResult = {
  status: UserClaimStatus;
  winningBondTotal: bigint;
  winningAnswerLabel: string | null;
  contractBalance: bigint;
  userEntries: AnswerHistoryEntry[];
};

const ZERO_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function normalizeAddresses(addresses: (string | null | undefined)[]): Address[] {
  const seen = new Set<string>();
  const result: Address[] = [];
  for (const addr of addresses) {
    if (!addr || !isAddress(addr)) continue;
    const normalized = getAddress(addr).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(getAddress(addr));
  }
  return result;
}

function normalizeAnswerHex(hex: string): string {
  return hex.toLowerCase();
}

function filterUserEntries(
  history: AnswerHistoryEntry[],
  addresses: Address[]
): AnswerHistoryEntry[] {
  const addrSet = new Set(addresses.map((a) => a.toLowerCase()));
  return history.filter(
    (e) => !e.is_commitment && addrSet.has(e.user.toLowerCase())
  );
}

function sumWinningBonds(
  entries: AnswerHistoryEntry[],
  finalAnswer: string
): bigint {
  const target = normalizeAnswerHex(finalAnswer);
  return entries
    .filter((e) => normalizeAnswerHex(e.answer) === target)
    .reduce((sum, e) => sum + e.bond, 0n);
}

export async function getUserClaimStatus(params: {
  publicClient: PublicClient;
  questionId: string;
  addresses: (string | null | undefined)[];
  finalAnswer: string | null;
  parsed: ParsedPredictionDisplay;
}): Promise<UserClaimStatusResult> {
  const addrs = normalizeAddresses(params.addresses);
  const empty: UserClaimStatusResult = {
    status: "not_participant",
    winningBondTotal: 0n,
    winningAnswerLabel: null,
    contractBalance: 0n,
    userEntries: [],
  };

  if (!params.finalAnswer || params.finalAnswer === ZERO_ANSWER) {
    return empty;
  }

  if (addrs.length === 0) {
    return empty;
  }

  const finalized = await isQuestionFinalized(
    params.publicClient,
    params.questionId
  );
  if (!finalized) {
    return empty;
  }

  const history = await getAnswerHistory(params.publicClient, params.questionId);
  const userEntries = filterUserEntries(history, addrs);

  if (userEntries.length === 0) {
    return empty;
  }

  const winningBondTotal = sumWinningBonds(userEntries, params.finalAnswer);
  const winningAnswerLabel = answerBytesToLabel(
    params.finalAnswer,
    params.parsed
  );

  let contractBalance = 0n;
  for (const addr of addrs) {
    contractBalance += await getBalanceOf(params.publicClient, addr);
  }

  if (winningBondTotal > 0n) {
    if (contractBalance > 0n) {
      return {
        status: "won_withdrawable",
        winningBondTotal,
        winningAnswerLabel,
        contractBalance,
        userEntries,
      };
    }
    return {
      status: "won_pending_claim",
      winningBondTotal,
      winningAnswerLabel,
      contractBalance,
      userEntries,
    };
  }

  if (contractBalance > 0n) {
    return {
      status: "won_withdrawable",
      winningBondTotal: 0n,
      winningAnswerLabel,
      contractBalance,
      userEntries,
    };
  }

  return {
    status: "bonded_lost",
    winningBondTotal: 0n,
    winningAnswerLabel,
    contractBalance: 0n,
    userEntries,
  };
}
