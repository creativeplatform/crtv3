import { template as realityTemplate } from "@reality.eth/reality-eth-lib";
import type { QuestionType } from "@/lib/sdk/reality-eth/reality-eth-utils";

/** Standard Reality.eth template IDs (see @reality.eth/contracts/config/templates.json). */
export function getTemplateIdForQuestionType(type: QuestionType): number {
  const id = realityTemplate.defaultTemplateIDForType(type);
  if (typeof id !== "number" || Number.isNaN(id)) {
    throw new Error(`No Reality.eth template for question type: ${type}`);
  }
  return id;
}

export function getTemplateTextForId(templateId: number): string | undefined {
  const contents = realityTemplate.preloadedTemplateContents() as Record<
    string,
    string
  >;
  return contents[String(templateId)];
}

export function getTemplateTextForQuestionType(type: QuestionType): string {
  return realityTemplate.defaultTemplateForType(type);
}
