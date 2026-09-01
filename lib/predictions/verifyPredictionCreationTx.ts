import { decodeEventLog, parseAbi, type Hash } from "viem";
import { getRealityEthContractAddress } from "@/lib/sdk/reality-eth/reality-eth-client";
import {
  getVerifiedTransactionReceipt,
  TransactionVerificationError,
} from "@/lib/chain/verifyTransactionReceipt";

const logNewQuestionAbi = parseAbi([
  "event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)",
]);

export interface VerifiedPredictionCreation {
  questionId: Hash;
  creatorAddress: string;
  transactionHash: string;
}

/**
 * Verify a Base-chain tx created a Reality.eth question for the given creator.
 */
export async function verifyPredictionCreationTx(
  transactionHash: string,
  creatorAddress: string,
): Promise<VerifiedPredictionCreation> {
  const normalizedCreator = creatorAddress.trim().toLowerCase();
  const { receipt } = await getVerifiedTransactionReceipt(transactionHash, {
    maxAgeSeconds: 60 * 60 * 24 * 30,
  });

  const realityAddress = getRealityEthContractAddress().toLowerCase();
  let sawUserMismatch = false;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== realityAddress) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: logNewQuestionAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "LogNewQuestion") {
        continue;
      }
      const args = decoded.args as {
        question_id: Hash;
        user: string;
      };
      if (args.user.toLowerCase() !== normalizedCreator) {
        sawUserMismatch = true;
        continue;
      }
      return {
        questionId: args.question_id,
        creatorAddress: normalizedCreator,
        transactionHash: transactionHash.toLowerCase(),
      };
    } catch {
      // Not a LogNewQuestion log — try next.
    }
  }

  if (sawUserMismatch) {
    throw new TransactionVerificationError(
      "Transaction creator does not match authenticated address",
    );
  }

  throw new TransactionVerificationError(
    "No valid Reality.eth question creation found in transaction",
  );
}
