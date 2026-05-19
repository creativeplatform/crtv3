import { gql } from "@apollo/client";

/**
 * Reality.eth Subgraph Queries
 * 
 * GraphQL queries for fetching Reality.eth questions and answers
 * from the Goldsky-hosted subgraph
 *
 * Note: The Goldsky `reality-eth/1.0.0` deployment exposes `logNewQuestions`, not `questions`.
 */

/** List questions from log entities (Goldsky reality-eth subgraph). */
export const GET_LOG_NEW_QUESTIONS_LIST = gql`
  query GetLogNewQuestionsList($first: Int!, $skip: Int!) {
    logNewQuestions(
      first: $first
      skip: $skip
      orderBy: opening_ts
      orderDirection: desc
    ) {
      id
      question_id
      template_id
      question
      arbitrator
      opening_ts
      timeout
    }
  }
`;

/** List questions without filters (predictions page). Graph Studio / merged subgraphs use this. */
export const GET_QUESTIONS_LIST = gql`
  query GetQuestionsList($first: Int!, $skip: Int!) {
    questions(
      first: $first
      skip: $skip
      orderBy: created
      orderDirection: desc
    ) {
      id
      template_id
      question
      created
      opening_ts
      timeout
      finalize_ts
      is_pending_arbitration
      bounty
      best_answer
      history_hash
      arbitrator
      min_bond
      last_bond
      last_bond_ts
      category
      language
      outcomes
    }
  }
`;

/** Same as GET_QUESTIONS_LIST but orderBy opening_ts (some deployments index this more reliably). */
export const GET_QUESTIONS_LIST_BY_OPENING_TS = gql`
  query GetQuestionsListByOpening($first: Int!, $skip: Int!) {
    questions(
      first: $first
      skip: $skip
      orderBy: opening_ts
      orderDirection: desc
    ) {
      id
      template_id
      question
      created
      opening_ts
      timeout
      finalize_ts
      is_pending_arbitration
      bounty
      best_answer
      history_hash
      arbitrator
      min_bond
      last_bond
      last_bond_ts
      category
      language
      outcomes
    }
  }
`;

/** Minimal field set if optional columns are missing from an older subgraph schema. */
export const GET_QUESTIONS_LIST_MINIMAL = gql`
  query GetQuestionsListMinimal($first: Int!, $skip: Int!) {
    questions(
      first: $first
      skip: $skip
      orderBy: opening_ts
      orderDirection: desc
    ) {
      id
      template_id
      question
      created
      opening_ts
      timeout
      finalize_ts
      is_pending_arbitration
      bounty
      best_answer
      history_hash
      arbitrator
      min_bond
      last_bond
      last_bond_ts
    }
  }
`;

export const GET_QUESTIONS = gql`
  query GetQuestions($first: Int!, $skip: Int!, $where: Question_filter) {
    questions(
      first: $first
      skip: $skip
      where: $where
      orderBy: created
      orderDirection: desc
    ) {
      id
      template_id
      question
      created
      opening_ts
      timeout
      finalize_ts
      is_pending_arbitration
      bounty
      best_answer
      history_hash
      arbitrator
      min_bond
      last_bond
      last_bond_ts
      category
      language
      outcomes
    }
  }
`;

export const GET_QUESTION = gql`
  query GetQuestion($id: ID!) {
    question(id: $id) {
      id
      template_id
      question
      created
      opening_ts
      timeout
      finalize_ts
      is_pending_arbitration
      bounty
      best_answer
      history_hash
      arbitrator
      min_bond
      last_bond
      last_bond_ts
      category
      language
      outcomes
      answers {
        id
        answer
        bond
        answerer
        created
      }
    }
  }
`;

export const GET_ANSWERS = gql`
  query GetAnswers($questionId: ID!, $first: Int!, $skip: Int!) {
    answers(
      first: $first
      skip: $skip
      where: { question: $questionId }
      orderBy: created
      orderDirection: desc
    ) {
      id
      answer
      bond
      answerer
      created
      question {
        id
        best_answer
      }
    }
  }
`;

/**
 * Get subgraph endpoint URL
 * Public URL: https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/reality-eth/1.0.0/gn
 * Uses the same project as MeTokens subgraphs by default
 */
export function getRealityEthSubgraphUrl(
  version: string = "1.0.0",
  accessType: "public" | "private" = "public"
): string {
  // Use GOLDSKY_REALITY_ETH_PROJECT_ID if set, otherwise fallback to MeTokens project ID
  const projectId = process.env.GOLDSKY_REALITY_ETH_PROJECT_ID || process.env.GOLDSKY_PROJECT_ID || "project_cmh0iv6s500dbw2p22vsxcfo6";
  return `https://api.goldsky.com/api/${accessType}/${projectId}/subgraphs/reality-eth/${version}/gn`;
}
