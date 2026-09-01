export type OrbPollVoter = {
  id?: string;
  username?: string | null;
  address?: string;
};

export type OrbPollOptionResult = {
  option: string;
  voteCount: number;
  votePercentage: number;
  myVote: boolean;
  voters?: OrbPollVoter[];
  optionKey: number;
};

export type OrbPollVotersData = {
  options: OrbPollOptionResult[];
  endTimestamp: number;
  allowMultipleAnswers: boolean;
  totalVotes: number;
  isActive: boolean;
};

export type OrbPollApiResponse<T> = {
  status: "SUCCESS" | "ERROR";
  data?: T;
  message?: string;
};

export type OrbPollCreatePostRequest = {
  publicationType: "TEXT_ONLY";
  content: string;
  groupId?: string;
  poll: {
    endTimestamp: number;
    allowMultipleAnswers: boolean;
    questions: string[];
  };
};

export type OrbPollCreatePostData = {
  type: "HASH" | string;
  hash?: string;
  id?: string;
};
