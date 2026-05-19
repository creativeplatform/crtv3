import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  LogFinalize as LogFinalizeEvent,
  LogNewAnswer as LogNewAnswerEvent,
  LogNewQuestion as LogNewQuestionEvent
} from "../generated/RealityETH/RealityETH";
import { Answer, Question } from "../generated/schema";

function getOrCreateQuestion(id: Bytes): Question {
  let question = Question.load(id);
  if (question == null) {
    question = new Question(id);
    question.template_id = BigInt.zero();
    question.question = "";
    question.created = BigInt.zero();
    question.opening_ts = BigInt.zero();
    question.timeout = BigInt.zero();
    question.finalize_ts = null;
    question.is_pending_arbitration = false;
    question.bounty = BigInt.zero();
    question.best_answer = Bytes.empty();
    question.history_hash = Bytes.empty();
    question.arbitrator = Bytes.empty();
    question.min_bond = BigInt.zero();
    question.last_bond = BigInt.zero();
    question.last_bond_ts = BigInt.zero();
    question.category = null;
    question.language = null;
    question.outcomes = null;
  }
  return question as Question;
}

export function handleNewQuestion(event: LogNewQuestionEvent): void {
  const question = getOrCreateQuestion(event.params.question_id);
  question.template_id = event.params.template_id;
  question.question = event.params.question;
  question.created = event.params.created;
  question.opening_ts = event.params.opening_ts;
  question.timeout = event.params.timeout;
  // Base RealityETH-3.0 LogNewQuestion has no bounty/finalize/best_answer; set safe defaults.
  question.finalize_ts = null;
  question.is_pending_arbitration = false;
  question.bounty = BigInt.zero();
  question.best_answer = Bytes.empty();
  question.history_hash = event.params.content_hash;
  question.arbitrator = changetype<Bytes>(event.params.arbitrator);
  question.last_bond = BigInt.zero();
  question.last_bond_ts = event.params.created;
  question.min_bond = BigInt.zero();
  question.save();
}

export function handleNewAnswer(event: LogNewAnswerEvent): void {
  const question = getOrCreateQuestion(event.params.question_id);
  question.best_answer = event.params.answer;
  question.last_bond = event.params.bond;
  question.last_bond_ts = event.params.ts;
  question.history_hash = event.params.history_hash;
  question.min_bond = BigInt.zero();
  question.is_pending_arbitration = false;
  question.save();

  const answer = new Answer(event.transaction.hash.concatI32(event.logIndex.toI32()));
  answer.question = question.id;
  answer.answer = event.params.answer;
  answer.bond = event.params.bond;
  answer.answerer = changetype<Bytes>(event.params.user);
  answer.created = event.params.ts;
  answer.is_commitment = event.params.is_commitment;
  answer.history_hash = event.params.history_hash;
  answer.transactionHash = event.transaction.hash;
  answer.blockNumber = event.block.number;
  answer.blockTimestamp = event.block.timestamp;
  answer.save();
}

export function handleFinalize(event: LogFinalizeEvent): void {
  const question = getOrCreateQuestion(event.params.question_id);
  question.best_answer = event.params.answer;
  question.finalize_ts = event.block.timestamp;
  question.is_pending_arbitration = false;
  question.save();
}
