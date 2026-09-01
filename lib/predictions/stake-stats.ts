import { formatEther, keccak256, stringToHex } from "viem";
import {
  answerBytesToLabel,
  type ParsedPredictionDisplay,
} from "@/lib/predictions/parse-prediction-display";

export type AnswerBondInput = {
  answer: string;
  bond: string | bigint;
};

export type PerOutcomeStake = {
  label: string;
  answerHex: string;
  totalBond: bigint;
  count: number;
};

export type StakeStats = {
  totalBonded: bigint;
  totalPrizePool: bigint;
  perOutcome: PerOutcomeStake[];
  leadingBond: bigint;
  minBond: bigint;
  bounty: bigint;
};

export type ListStakeSummary = {
  totalBonded: string;
  totalPrizePool: string;
  leadingBond: string;
  answerCount: number;
};

function toBigInt(value: string | bigint | undefined | null): bigint {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function normalizeAnswerHex(hex: string): string {
  return hex.toLowerCase();
}

export function computeStakeStats(params: {
  bounty: string | bigint;
  minBond: string | bigint;
  leadingBond: string | bigint;
  answers: AnswerBondInput[];
  parsed: ParsedPredictionDisplay;
}): StakeStats {
  const bounty = toBigInt(params.bounty);
  const minBond = toBigInt(params.minBond);
  const leadingBond = toBigInt(params.leadingBond);

  const byAnswer = new Map<
    string,
    { label: string; totalBond: bigint; count: number }
  >();

  let totalBonded = 0n;
  for (const entry of params.answers) {
    const bond = toBigInt(entry.bond);
    totalBonded += bond;
    const hex = normalizeAnswerHex(entry.answer);
    const label =
      answerBytesToLabel(entry.answer, params.parsed) ??
      `${hex.slice(0, 10)}…`;
    const existing = byAnswer.get(hex);
    if (existing) {
      existing.totalBond += bond;
      existing.count += 1;
    } else {
      byAnswer.set(hex, { label, totalBond: bond, count: 1 });
    }
  }

  const perOutcome: PerOutcomeStake[] = [...byAnswer.entries()].map(
    ([answerHex, value]) => ({
      answerHex,
      ...value,
    })
  );

  perOutcome.sort((a, b) => {
    if (a.totalBond > b.totalBond) return -1;
    if (a.totalBond < b.totalBond) return 1;
    return 0;
  });

  return {
    totalBonded,
    totalPrizePool: bounty + totalBonded,
    perOutcome,
    leadingBond,
    minBond,
    bounty,
  };
}

export function toListStakeSummary(stats: StakeStats, answerCount: number): ListStakeSummary {
  return {
    totalBonded: stats.totalBonded.toString(),
    totalPrizePool: stats.totalPrizePool.toString(),
    leadingBond: stats.leadingBond.toString(),
    answerCount,
  };
}

export function computeListStakeSummary(params: {
  bounty: string | bigint;
  leadingBond: string | bigint;
  answers: AnswerBondInput[];
}): ListStakeSummary {
  const bounty = toBigInt(params.bounty);
  const leadingBond = toBigInt(params.leadingBond);
  let totalBonded = 0n;
  for (const entry of params.answers) {
    totalBonded += toBigInt(entry.bond);
  }
  return {
    totalBonded: totalBonded.toString(),
    totalPrizePool: (bounty + totalBonded).toString(),
    leadingBond: leadingBond.toString(),
    answerCount: params.answers.length,
  };
}

export function formatEth(wei: bigint, decimals = 4): string {
  return Number(formatEther(wei)).toFixed(decimals);
}

export function resolveSelectedAnswerHex(
  selectedAnswer: string,
  questionType: ParsedPredictionDisplay["type"],
  outcomes?: string[]
): `0x${string}` | null {
  if (questionType === "bool") {
    return selectedAnswer === "true"
      ? "0x0000000000000000000000000000000000000000000000000000000000000001"
      : "0x0000000000000000000000000000000000000000000000000000000000000000";
  }
  if (questionType === "single-select" && outcomes) {
    const idx = parseInt(selectedAnswer, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= outcomes.length) return null;
    return keccak256(stringToHex(outcomes[idx])) as `0x${string}`;
  }
  return null;
}

/**
 * Estimates potential earnings if the selected outcome wins.
 * Note: Reality.eth uses a sequential bonding model where incorrect bonds are distributed
 * to the next correct answerer, rather than a proportional pool-based distribution.
 * This pool-based calculation serves as a simplified heuristic for estimation.
 */
export function estimateEarningsIfWin(params: {
  stats: StakeStats;
  selectedAnswerHex: string;
  userBond: bigint;
}): bigint | null {
  if (params.userBond <= 0n) return null;

  const selectedHex = normalizeAnswerHex(params.selectedAnswerHex);
  const outcome = params.stats.perOutcome.find(
    (o) => normalizeAnswerHex(o.answerHex) === selectedHex
  );
  const outcomeBond = outcome?.totalBond ?? 0n;
  const totalOutcomeBondAfter = outcomeBond + params.userBond;
  const otherBonds = params.stats.totalBonded - outcomeBond;
  const distributable = otherBonds + params.stats.bounty;

  const share =
    totalOutcomeBondAfter > 0n
      ? (params.userBond * distributable) / totalOutcomeBondAfter
      : 0n;

  return params.userBond + share;
}

/** Minimum bond to participate: max(min_bond, 2× leading bond when a leading answer exists). */
export function minBondRequired(minBond: bigint, leadingBond: bigint): bigint {
  const beatLeading = leadingBond > 0n ? leadingBond * 2n : 0n;
  return minBond > beatLeading ? minBond : beatLeading;
}
