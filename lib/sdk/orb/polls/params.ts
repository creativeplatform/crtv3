import { encodeAbiParameters } from "viem";
import { ORB_POLL_PARAM_KEYS } from "./constants";

export type OrbPollCreateConfig = {
  endTimestamp: number;
  allowMultipleAnswers: boolean;
  questions: string[];
};

/** Params for Lens `post` with unknown poll action (create-poll.js). */
export function getOrbPollCreateParams(poll: OrbPollCreateConfig) {
  return [
    {
      raw: {
        data: encodeAbiParameters([{ type: "uint72" }], [BigInt(poll.endTimestamp)]),
        key: ORB_POLL_PARAM_KEYS.endTimestamp,
      },
    },
    {
      raw: {
        data: encodeAbiParameters([{ type: "bool" }], [poll.allowMultipleAnswers]),
        key: ORB_POLL_PARAM_KEYS.allowMultipleAnswers,
      },
    },
    {
      raw: {
        data: encodeAbiParameters([{ type: "string[]" }], [poll.questions]),
        key: ORB_POLL_PARAM_KEYS.options,
      },
    },
  ];
}

/** Params for Lens `executePostAction` when voting (vote.js). */
export function getOrbPollVoteParams(pollOptionIndices: number[]) {
  if (!Array.isArray(pollOptionIndices) || pollOptionIndices.length === 0) {
    throw new Error("pollOptionIndices must be a non-empty array");
  }

  return [
    {
      key: ORB_POLL_PARAM_KEYS.voteOptions,
      data: encodeAbiParameters(
        [{ type: "uint8[]" }],
        [pollOptionIndices.map((n) => Number(n))],
      ),
    },
  ];
}
