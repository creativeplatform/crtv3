import { type Address, type PublicClient, type WalletClient, encodeFunctionData, parseAbi, keccak256, encodePacked } from "viem";
import { base } from "@account-kit/infra";
import { getRealityEthContract, getRealityEthContractAddress, getRealityEthABI } from "./reality-eth-client";
import { encodeQuestionText, validateQuestionData, type QuestionData } from "./reality-eth-utils";
import { serverLogger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


/**
 * Reality.eth Question Wrapper
 * 
 * Handles question creation and answer submission to Reality.eth contracts
 */

export interface CreateQuestionParams {
  templateId: number;
  questionText: string;
  arbitrator: Address;
  timeout: number; // seconds
  openingTs: number; // unix timestamp
  nonce: bigint;
  bond?: bigint; // Optional bond amount in wei
}

export interface SubmitAnswerParams {
  questionId: string; // bytes32 as hex string
  answer: string; // bytes32 as hex string
  maxPrevious: bigint;
  bond: bigint; // Bond amount in wei
}

/**
 * Create a new question on Reality.eth
 * 
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client or Account Kit smart account client
 * @param params - Question creation parameters
 * @returns Transaction hash
 */
export async function createQuestion(
  publicClient: PublicClient,
  walletClient: WalletClient | any, // Allow Account Kit client
  params: CreateQuestionParams
): Promise<`0x${string}`> {
  const contractAddress = getRealityEthContractAddress();
  const account = walletClient.account?.address;

  if (!account) {
    throw new Error("Wallet account not found");
  }

  const { templateId, questionText, arbitrator, timeout, openingTs, nonce, bond = 0n } = params;

  // Validate all required parameters
  if (questionText === undefined || questionText === null || questionText === "") {
    throw new Error("Question text is required and cannot be empty");
  }

  if (arbitrator === undefined || arbitrator === null) {
    throw new Error("Arbitrator address is required");
  }

  if (timeout === undefined || timeout === null || isNaN(timeout)) {
    throw new Error("Timeout is required and must be a valid number");
  }

  if (openingTs === undefined || openingTs === null || isNaN(openingTs)) {
    throw new Error("Opening timestamp is required and must be a valid number");
  }

  serverLogger.debug("🔍 Encoding function data with params:", {
    templateId,
    questionText: questionText.substring(0, 50) + "...",
    arbitrator,
    timeout,
    openingTs,
    nonce: nonce.toString(),
  });

  let abi: any[];
  try {
    abi = getRealityEthABI();
  } catch (abiError: any) {
    serverLogger.error("❌ Failed to get Reality.eth ABI:", abiError);
    throw new Error(`Failed to load Reality.eth ABI: ${abiError?.message || 'Unknown error'}`);
  }

  if (!abi || !Array.isArray(abi) || abi.length === 0) {
    serverLogger.error("❌ ABI validation failed:", {
      abiType: typeof abi,
      abiIsArray: Array.isArray(abi),
      abiLength: Array.isArray(abi) ? abi.length : 'N/A',
      abiValue: abi,
    });
    throw new Error("Reality.eth ABI is not available or invalid");
  }

  serverLogger.debug("✅ ABI loaded successfully, length:", abi.length);

  // Verify the function exists in the ABI
  const askQuestionFunction = abi.find(
    (item: any) => item.type === "function" &&
      (item.name === "askQuestion" || item.name === "ask_question")
  );

  if (!askQuestionFunction) {
    serverLogger.error("❌ askQuestion function not found in ABI. Available functions:",
      abi.filter((item: any) => item.type === "function").map((item: any) => item.name)
    );
    throw new Error("askQuestion function not found in Reality.eth ABI. The ABI may be incorrect or the function name may be different.");
  }

  serverLogger.debug("✅ Found askQuestion function in ABI:", {
    name: askQuestionFunction.name,
    inputs: askQuestionFunction.inputs?.length || 0,
  });

  let data: `0x${string}`;
  try {
    // Use the actual function name from the ABI
    const functionName = askQuestionFunction.name;
    data = encodeFunctionData({
      abi,
      functionName: functionName,
      args: [BigInt(templateId), questionText, arbitrator, Number(timeout), Number(openingTs), nonce],
    });

    serverLogger.debug("✅ Function data encoded successfully, length:", data?.length || 0);
  } catch (encodeError: any) {
    serverLogger.error("❌ Error encoding function data:", encodeError);
    serverLogger.error("❌ Error details:", {
      abiLength: abi?.length,
      templateId,
      questionTextType: typeof questionText,
      questionTextValue: questionText,
      arbitrator,
      timeout,
      openingTs,
      nonce: nonce?.toString(),
    });
    throw new Error(`Failed to encode function call: ${encodeError?.message || 'Unknown error'}`);
  }

  // Check if this is an Account Kit smart account client (has sendUserOperation)
  if (walletClient.sendUserOperation && typeof walletClient.sendUserOperation === 'function') {
    serverLogger.debug("📦 Using Account Kit sendUserOperation");

    try {
      // Use Account Kit's sendUserOperation
      const operation = await walletClient.sendUserOperation({
        uo: {
          target: contractAddress,
          data: appendBuilderCode(data as `0x${string}`),
          value: bond,
        },
      });

      serverLogger.debug("✅ User operation sent, hash:", operation.hash);

      // Wait for the transaction to be mined
      if (walletClient.waitForUserOperationTransaction) {
        const receipt = await walletClient.waitForUserOperationTransaction({
          hash: operation.hash,
        });
        serverLogger.debug("✅ Transaction receipt received:", receipt);

        if (typeof receipt === 'string') {
          return receipt as `0x${string}`;
        }

        if (receipt && typeof receipt === 'object') {
          // Check for direct transactionHash property (viem TransactionReceipt)
          if ('transactionHash' in receipt) {
            return (receipt as any).transactionHash as `0x${string}`;
          }
          // Check for nested receipt property (Account Kit potential return)
          if ('receipt' in receipt && (receipt as any).receipt && (receipt as any).receipt.transactionHash) {
            return (receipt as any).receipt.transactionHash as `0x${string}`;
          }
        }

        serverLogger.error("❌ Invalid receipt format:", receipt);
        throw new Error("Failed to retrieve transaction hash from user operation receipt");
      }

      // If no wait method, return the operation hash
      return operation.hash as `0x${string}`;
    } catch (uoError: any) {
      serverLogger.error("❌ Error sending user operation:", uoError);
      throw new Error(`Failed to send user operation: ${uoError?.message || 'Unknown error'}`);
    }
  }

  // Fallback to regular wallet client sendTransaction
  serverLogger.debug("📝 Using regular wallet sendTransaction");
  try {
    const hash = await walletClient.sendTransaction({
      chain: walletClient.chain || base,
      to: contractAddress,
      data,
      value: bond,
      account,
    });

    return hash;
  } catch (txError: any) {
    serverLogger.error("❌ Error sending transaction:", txError);
    throw new Error(`Failed to send transaction: ${txError?.message || 'Unknown error'}`);
  }
}

/**
 * Submit an answer to a Reality.eth question
 * 
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client
 * @param params - Answer submission parameters
 * @returns Transaction hash
 */
export async function submitAnswer(
  publicClient: PublicClient,
  walletClient: WalletClient | any,
  params: SubmitAnswerParams
): Promise<`0x${string}`> {
  const contractAddress = getRealityEthContractAddress();
  const account = walletClient.account?.address;

  if (!account) {
    throw new Error("Wallet account not found");
  }

  const { questionId, answer, maxPrevious, bond } = params;

  const abi = getRealityEthABI();
  const data = encodeFunctionData({
    abi,
    functionName: "submitAnswer",
    args: [questionId as `0x${string}`, answer as `0x${string}`, maxPrevious],
  });

  // Check if this is an Account Kit smart account client (has sendUserOperation)
  if (walletClient.sendUserOperation && typeof walletClient.sendUserOperation === 'function') {
    serverLogger.debug("📦 Using Account Kit sendUserOperation for submitAnswer");

    try {
      const operation = await walletClient.sendUserOperation({
        uo: {
          target: contractAddress,
          data: appendBuilderCode(data as `0x${string}`),
          value: bond,
        },
      });

      serverLogger.debug("✅ User operation sent, hash:", operation.hash);

      if (walletClient.waitForUserOperationTransaction) {
        const receipt = await walletClient.waitForUserOperationTransaction({
          hash: operation.hash,
        });
        serverLogger.debug("✅ Transaction receipt received:", receipt);

        if (typeof receipt === 'string') {
          return receipt as `0x${string}`;
        }

        if (receipt && typeof receipt === 'object') {
          if ('transactionHash' in receipt) {
            return (receipt as any).transactionHash as `0x${string}`;
          }
          if ('receipt' in receipt && (receipt as any).receipt && (receipt as any).receipt.transactionHash) {
            return (receipt as any).receipt.transactionHash as `0x${string}`;
          }
        }

        // If we can't find the hash but the op succeeded, return op hash
        return operation.hash as `0x${string}`;
      }

      return operation.hash as `0x${string}`;
    } catch (uoError: any) {
      serverLogger.error("❌ Error sending user operation:", uoError);
      throw new Error(`Failed to send user operation: ${uoError?.message || 'Unknown error'}`);
    }
  }

  // Fallback to regular wallet client sendTransaction
  serverLogger.debug("📝 Using regular wallet sendTransaction");
  const hash = await walletClient.sendTransaction({
    chain: walletClient.chain || base,
    to: contractAddress,
    data,
    value: bond,
    account,
  });

  return hash;
}

/**
 * Question data structure from Reality.eth contract
 */
export interface RealityEthQuestion {
  question: string;
  opening_ts: bigint;
  timeout: bigint;
  finalize_ts: bigint;
  is_pending_arbitration: boolean;
  bounty: bigint;
  best_answer: string; // bytes32 hex string
  history_hash: string; // bytes32 hex string
  bond: bigint;
  min_bond: bigint;
  [key: string]: any; // Allow additional properties
}

/**
 * Get question details from Reality.eth contract
 * 
 * @param publicClient - Viem public client
 * @param questionId - Question ID (bytes32 as hex string)
 * @returns Question data
 */
export async function getQuestion(
  publicClient: PublicClient,
  questionId: string
): Promise<RealityEthQuestion> {
  const contract = getRealityEthContract(publicClient);
  const contractAddress = getRealityEthContractAddress();

  try {
    // 1. Fetch question data from contract state
    const questionDataRaw = await contract.read.questions([questionId as `0x${string}`]);

    // Map the raw data (which might be an array/tuple) to our interface
    // struct Question {
    //     bytes32 content_hash;
    //     address arbitrator;
    //     uint32 opening_ts;
    //     uint32 timeout;
    //     uint32 finalize_ts;
    //     bool is_pending_arbitration;
    //     uint256 bounty;
    //     bytes32 best_answer;
    //     bytes32 history_hash;
    //     uint256 bond;
    //     uint256 min_bond;
    // }
    let structData: any = {};

    if (Array.isArray(questionDataRaw)) {
      structData = {
        content_hash: questionDataRaw[0],
        arbitrator: questionDataRaw[1],
        opening_ts: questionDataRaw[2],
        timeout: questionDataRaw[3],
        finalize_ts: questionDataRaw[4],
        is_pending_arbitration: questionDataRaw[5],
        bounty: questionDataRaw[6],
        best_answer: questionDataRaw[7],
        history_hash: questionDataRaw[8],
        bond: questionDataRaw[9],
        min_bond: questionDataRaw[10],
      };
    } else {
      structData = questionDataRaw;
    }

    // 2. Fetch question text from event logs
    // Event: LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, ...)
    let questionText = "";

    try {
      // Use a more recent block if possible to avoid 503 errors on public RPCs
      // Base Mainnet started logging Reality.eth around block 2000000 (rough estimate for older deployments)
      // or just retry gracefully. 
      // For now, we wrap in try/catch so the main data still loads.
      const logs = await publicClient.getLogs({
        address: contractAddress,
        event: parseAbi(['event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)'])[0],
        args: {
          question_id: questionId as `0x${string}`
        },
        fromBlock: 0n // Explicit 0n instead of 'earliest' sometimes helps, but main fix is try/catch
      });

      if (logs.length > 0) {
        const logArgs = logs[0].args as any;
        questionText = logArgs.question;
      } else {
        serverLogger.warn(`No LogNewQuestion event found for ${questionId}. Title might be missing.`);
      }
    } catch (logError) {
      serverLogger.warn("⚠️ Failed to fetch question text logs (likely RPC 503 or timeout). Returning Untitled.", logError);
      // Fallback to untitled, do not crash
      questionText = "Untitled Prediction (Error loading valid title)";
    }

    return {
      ...structData,
      question: questionText,
      // Ensure bigints are returned as is, conversions happen in UI
    } as RealityEthQuestion;

  } catch (error) {
    serverLogger.error("Error fetching question:", error);
    throw new Error("Failed to fetch question from contract");
  }
}

/**
 * Get the final answer for a question
 * 
 * @param publicClient - Viem public client
 * @param questionId - Question ID (bytes32 as hex string)
 * @returns Final answer (bytes32 as hex string)
 */
export async function getFinalAnswer(
  publicClient: PublicClient,
  questionId: string
): Promise<string | null> {
  const contract = getRealityEthContract(publicClient);

  try {
    const answer = await contract.read.getFinalAnswer([questionId as `0x${string}`]);
    return answer as unknown as string;
  } catch (error: any) {
    // Check if the error is due to the question not being finalized
    if (error?.message?.includes("question must be finalized") ||
      error?.cause?.message?.includes("question must be finalized")) {
      return null;
    }

    serverLogger.error("Error fetching final answer:", error);
    throw new Error("Failed to fetch final answer");
  }
}

/**
 * Answer history entry from LogNewAnswer events (chronological order)
 */
export interface AnswerHistoryEntry {
  answer: `0x${string}`;
  history_hash: `0x${string}`;
  user: Address;
  bond: bigint;
  ts: bigint;
  is_commitment: boolean;
}

/**
 * Attempt to reconstruct missing initial history entry by brute-force hashing common values.
 * Useful if the first answer log is missing but we know its resulting hash (the history_hash of the next answer).
 */
function reconstructMissingEntry(targetHash: string, questionCreator: Address, arbitrator: Address, minBond: bigint): AnswerHistoryEntry | null {
  const zero = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  const potentialAnswers: `0x${string}`[] = [
    zero, // 0 (No / Unresolved)
    "0x0000000000000000000000000000000000000000000000000000000000000001", // 1 (Yes)
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // Invalid
  ];
  // Try 0, minBond, and common bond amounts (0.001, 0.01, 0.1, 1 ETH)
  const potentialBonds = [0n, minBond, 1000000000000000n, 10000000000000000n, 100000000000000000n, 1000000000000000000n];
  // Deduplicate bonds
  const uniqueBonds = [...new Set(potentialBonds)];

  const potentialUsers = [questionCreator, arbitrator, "0x0000000000000000000000000000000000000000" as Address];

  for (const ans of potentialAnswers) {
    for (const bond of uniqueBonds) {
      for (const user of potentialUsers) {
        for (const isCommitment of [false, true]) {
          try {
            const hash = keccak256(
              encodePacked(
                ['bytes32', 'bytes32', 'uint256', 'address', 'bool'],
                [zero, ans, bond, user, isCommitment]
              )
            );
            if (hash === targetHash) {
              serverLogger.info(`🔧 RECONSTRUCTED MISSING HISTORY! Answer: ${ans}, Bond: ${bond}, User: ${user}, Commit: ${isCommitment}`);
              return {
                answer: ans,
                history_hash: zero,
                user: user,
                bond: bond,
                ts: 0n, // Unknown
                is_commitment: isCommitment
              };
            }
          } catch (e) { /* ignore */ }
        }
      }
    }
  }
  return null;
}


export async function getAnswerHistory(
  publicClient: PublicClient,
  questionId: string
): Promise<AnswerHistoryEntry[]> {
  const contractAddress = getRealityEthContractAddress();

  // 0. CRITICAL CHECK: Verify on-chain history hash first.
  // If the contract says history_hash is 0, we MUST provide an empty history for claimWinnings to succeed.
  // This handles edge cases where state might be paradoxical (e.g. Best Answer set but History 0).
  try {
    const questionAbi = parseAbi(["function questions(bytes32) view returns (bytes32, address, uint32, uint32, uint32, bool, uint256, bytes32, bytes32, uint256, uint256)"]);
    const qData = await publicClient.readContract({
      address: contractAddress,
      abi: questionAbi,
      functionName: 'questions',
      args: [questionId as `0x${string}`]
    }) as any;

    // qData[8] is history_hash
    if (Array.isArray(qData) && qData.length >= 9) {
      const onChainHistoryHash = qData[8];
      const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (onChainHistoryHash === zeroHash) {
        serverLogger.warn(`⚠️ On-chain history hash is ZERO for ${questionId}. Returning empty history to match contract state.`);
        return [];
      }
    }
  } catch (e) {
    serverLogger.warn("Could not fetch on-chain history hash, proceeding with logs...", e);
  }

  // 1. Try fetching from RPC logs
  const logNewAnswerAbi = parseAbi([
    "event LogNewAnswer(bytes32 answer, bytes32 indexed question_id, bytes32 history_hash, address indexed user, uint256 bond, uint256 ts, bool is_commitment)",
  ])[0] as any;

  let entries: AnswerHistoryEntry[] = [];

  try {
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: logNewAnswerAbi,
      args: { question_id: questionId as `0x${string}` },
      fromBlock: 'earliest', // Ensure we look from the beginning
    });

    const withMeta = logs.map((log) => {
      const a = (log as { args?: Record<string, unknown> }).args;
      if (!a || typeof a !== "object") throw new Error("LogNewAnswer: missing args");
      return {
        answer: a.answer as `0x${string}`,
        history_hash: a.history_hash as `0x${string}`,
        user: a.user as Address,
        bond: BigInt(String(a.bond)),
        ts: BigInt(String(a.ts)),
        is_commitment: Boolean(a.is_commitment),
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      };
    });

    withMeta.sort((x, y) => {
      if (x.blockNumber !== y.blockNumber) return x.blockNumber < y.blockNumber ? -1 : 1;
      return x.logIndex < y.logIndex ? -1 : x.logIndex > y.logIndex ? 1 : 0;
    });

    entries = withMeta.map(({ blockNumber: _, logIndex: __, ...e }) => e);
  } catch (err) {
    serverLogger.warn("Error fetching logs from RPC, trying subgraph...", err);
  }

  // 2. Check for missing start or empty logs -> Fallback to Subgraph
  const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  if (entries.length === 0 || entries[0].history_hash !== zeroHash) {
    serverLogger.info(`⚠️ RPC logs incomplete for ${questionId} (Start hash: ${entries[0]?.history_hash || 'none'}). Fetching from Subgraph...`);

    // Public Goldsky endpoint for Reality.eth on Base
    const GRAPH_URL = "https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/reality-eth/1.0.0/gn";

    const query = `
      query GetHistory($qId: String!) {
        logNewQuestions(where: { question_id: $qId }) {
           user
           arbitrator
        }
        logNewAnswers(where: { question_id: $qId }, orderBy: ts, orderDirection: asc) {
          answer
          history_hash
          user
          bond
          ts
          is_commitment
        }
      }
    `;

    try {
      const response = await fetch(GRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { qId: questionId } }),
      });

      const result = await response.json();
      const answerLogs = result.data?.logNewAnswers;
      const questionLog = result.data?.logNewQuestions?.[0]; // Get creator/arbitrator info

      if (answerLogs && Array.isArray(answerLogs)) {
        entries = answerLogs.map((a: any) => ({
          answer: a.answer as `0x${string}`,
          history_hash: a.history_hash as `0x${string}`,
          user: a.user as Address,
          bond: BigInt(a.bond),
          ts: BigInt(a.ts),
          is_commitment: Boolean(a.is_commitment),
        }));

        serverLogger.info(`✅ Fetched ${entries.length} entries from Subgraph`);

        // 3. Attempt Reconstruction if STILL missing start
        if (entries.length > 0 && entries[0].history_hash !== zeroHash) {
          serverLogger.warn("⚠️ Still missing initial history after Subgraph fetch. Attempting reconstruction...");

          // Fetch min_bond from contract to help reconstruction
          let minBond = 0n;
          try {
            const questionAbi = parseAbi(["function questions(bytes32) view returns (bytes32, address, uint32, uint32, uint32, bool, uint256, bytes32, bytes32, uint256, uint256)"]);
            // Note: ABI might vary, using a generous read or standard
            const qData = await publicClient.readContract({
              address: contractAddress,
              abi: questionAbi,
              functionName: 'questions',
              args: [questionId as `0x${string}`]
            }) as any;
            // min_bond is typically the last or near-last field
            // Based on Realitio v2.1: ... bond, min_bond
            if (Array.isArray(qData) && qData.length >= 11) {
              minBond = qData[10];
            }
          } catch (e) {
            serverLogger.warn("Could not fetch min_bond from contract", e);
          }

          const creator = questionLog?.user as Address || "0x0000000000000000000000000000000000000000";
          const arbitrator = questionLog?.arbitrator as Address || "0x0000000000000000000000000000000000000000";

          const reconstructed = reconstructMissingEntry(entries[0].history_hash, creator, arbitrator, minBond);

          if (reconstructed) {
            entries.unshift(reconstructed);
          } else {
            serverLogger.error("❌ Failed to reconstruct missing history entry. Claim will likely fail.");
          }
        }
      }
    } catch (graphErr) {
      serverLogger.error("Error fetching from subgraph:", graphErr);
      // Fallback: stick with what we have from RPC if subgraph fails, but likely doomed.
    }
  }

  return entries;
}

/**
 * Build arrays for claimWinnings from answer history.
 * Order: chronological (oldest first). history_hashes[i] = hash before entry i.
 */
export function buildClaimWinningsParams(entries: AnswerHistoryEntry[]): {
  history_hashes: `0x${string}`[];
  addrs: Address[];
  bonds: bigint[];
  answers: `0x${string}`[];
} {
  const history_hashes: `0x${string}`[] = [];
  const addrs: Address[] = [];
  const bonds: bigint[] = [];
  const answers: `0x${string}`[] = [];

  const zero = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  let current_hash = zero;

  serverLogger.debug(`🔨 Building claim params for ${entries.length} entries`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check for consistency with event log (debug only)
    if (current_hash !== entry.history_hash) {
      serverLogger.warn(`⚠️ Hash mismatch at input ${i}! Comp: ${current_hash}, Event: ${entry.history_hash}`);
      // We continue with *our* calculated hash to ensure the arrays are internally consistent 
      // for the claimWinnings transaction loop.
    }

    history_hashes.push(current_hash);
    addrs.push(entry.user);
    bonds.push(entry.bond);
    answers.push(entry.answer);

    // Calculate next hash for next iteration
    // Reality.eth 2.0/3.0 hash: keccak256(abi.encodePacked(history_hash, answer, bond, sender, is_commitment))
    try {
      current_hash = keccak256(
        encodePacked(
          ['bytes32', 'bytes32', 'uint256', 'address', 'bool'],
          [current_hash, entry.answer, entry.bond, entry.user, entry.is_commitment]
        )
      );
    } catch (e) {
      serverLogger.error("Error calculating hash:", e);
      // Fallback to event's next hash if calculation fails (unlikely)
      // We can't know the *next* hash from the *current* entry's event data directly 
      // (entry.history_hash is the *previous* hash). 
      // We would need entries[i+1].history_hash, or just trust the loop will fail.
    }
  }

  return { history_hashes, addrs, bonds, answers };
}

/**
 * Claim winnings for a finalized question. Distributes bounty and bonds to winners' contract balances.
 * Anyone can call this. Winners must then call withdraw() to receive ETH.
 */
export async function claimWinnings(
  publicClient: PublicClient,
  walletClient: WalletClient | any,
  params: {
    questionId: string;
    history_hashes: `0x${string}`[];
    addrs: Address[];
    bonds: bigint[];
    answers: `0x${string}`[];
  }
): Promise<`0x${string}`> {
  const contractAddress = getRealityEthContractAddress();
  const account = walletClient.account?.address;
  if (!account) throw new Error("Wallet account not found");

  const abi = getRealityEthABI();
  const data = encodeFunctionData({
    abi,
    functionName: "claimWinnings",
    args: [
      params.questionId as `0x${string}`,
      params.history_hashes,
      params.addrs,
      params.bonds,
      params.answers,
    ],
  });

  if (walletClient.sendUserOperation && typeof walletClient.sendUserOperation === "function") {
    const op = await walletClient.sendUserOperation({
      uo: { target: contractAddress, data: appendBuilderCode(data as `0x${string}`), value: 0n },
    });
    if (walletClient.waitForUserOperationTransaction) {
      const receipt = await walletClient.waitForUserOperationTransaction({ hash: op.hash });
      if (typeof receipt === "string") return receipt as `0x${string}`;
      if (receipt && typeof receipt === "object") {
        if ("transactionHash" in receipt) return (receipt as any).transactionHash as `0x${string}`;
        if ("receipt" in receipt && (receipt as any).receipt?.transactionHash)
          return (receipt as any).receipt.transactionHash as `0x${string}`;
      }
    }
    return op.hash as `0x${string}`;
  }

  const hash = await walletClient.sendTransaction({
    chain: walletClient.chain || base,
    to: contractAddress,
    data,
    value: 0n,
    account,
  });
  return hash;
}

/**
 * Withdraw your balance from the Reality.eth contract to your wallet.
 * Call after claimWinnings (or when you have balance from other questions).
 */
export async function withdraw(
  publicClient: PublicClient,
  walletClient: WalletClient | any
): Promise<`0x${string}`> {
  const contractAddress = getRealityEthContractAddress();
  const account = walletClient.account?.address;
  if (!account) throw new Error("Wallet account not found");

  const abi = getRealityEthABI();
  const data = encodeFunctionData({ abi, functionName: "withdraw", args: [] });

  if (walletClient.sendUserOperation && typeof walletClient.sendUserOperation === "function") {
    const op = await walletClient.sendUserOperation({
      uo: { target: contractAddress, data: appendBuilderCode(data as `0x${string}`), value: 0n },
    });
    if (walletClient.waitForUserOperationTransaction) {
      const receipt = await walletClient.waitForUserOperationTransaction({ hash: op.hash });
      if (typeof receipt === "string") return receipt as `0x${string}`;
      if (receipt && typeof receipt === "object") {
        if ("transactionHash" in receipt) return (receipt as any).transactionHash as `0x${string}`;
        if ("receipt" in receipt && (receipt as any).receipt?.transactionHash)
          return (receipt as any).receipt.transactionHash as `0x${string}`;
      }
    }
    return op.hash as `0x${string}`;
  }

  return walletClient.sendTransaction({
    chain: walletClient.chain || base,
    to: contractAddress,
    data,
    value: 0n,
    account,
  });
}

/**
 * Get a user's balance held in the Reality.eth contract (claimable via withdraw).
 */
export async function getBalanceOf(
  publicClient: PublicClient,
  address: Address
): Promise<bigint> {
  const contract = getRealityEthContract(publicClient);
  const r = await contract.read.balanceOf([address]);
  return typeof r === "bigint" ? r : (r as unknown as bigint[])[0];
}

/**
 * Check if a question is finalized.
 */
export async function isQuestionFinalized(
  publicClient: PublicClient,
  questionId: string
): Promise<boolean> {
  const contract = getRealityEthContract(publicClient);
  const r = await contract.read.isFinalized([questionId as `0x${string}`]);
  return typeof r === "boolean" ? r : (r as unknown as boolean[])[0];
}

/**
 * Create question with encoded text
 * 
 * Helper function that combines question encoding with creation
 */
export async function createQuestionWithData(
  publicClient: PublicClient,
  walletClient: WalletClient,
  questionData: QuestionData,
  params: Omit<CreateQuestionParams, "questionText">
): Promise<`0x${string}`> {
  // Validate question data
  const validation = validateQuestionData(questionData);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Encode question text
  let questionText: string;
  try {
    questionText = encodeQuestionText(questionData);

    if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
      throw new Error("Failed to encode question text: result is empty or invalid");
    }

    serverLogger.debug("✅ Question text encoded successfully, length:", questionText.length);
  } catch (encodeError: any) {
    serverLogger.error("❌ Error encoding question text:", encodeError);
    serverLogger.error("❌ Question data:", questionData);
    throw new Error(`Failed to encode question text: ${encodeError?.message || 'Unknown error'}`);
  }

  // Create question
  return createQuestion(publicClient, walletClient, {
    ...params,
    questionText,
  });
}
