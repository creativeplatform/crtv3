import type { QuestionType } from "@/lib/sdk/reality-eth/reality-eth-utils";
import { getTemplateIdForQuestionType } from "@/lib/predictions/reality-template";

export type RealityQuestionTypeOption = {
  value: QuestionType;
  label: string;
  description: string;
  templateId: number;
  requiresOutcomes: boolean;
};

export const REALITY_QUESTION_TYPES: RealityQuestionTypeOption[] = [
  {
    value: "bool",
    label: "Yes / No",
    description: "Binary question with Yes and No answers.",
    templateId: getTemplateIdForQuestionType("bool"),
    requiresOutcomes: false,
  },
  {
    value: "uint",
    label: "Number",
    description: "Numeric answer (e.g. price, count, score).",
    templateId: getTemplateIdForQuestionType("uint"),
    requiresOutcomes: false,
  },
  {
    value: "single-select",
    label: "Single choice",
    description: "Pick exactly one option from a list.",
    templateId: getTemplateIdForQuestionType("single-select"),
    requiresOutcomes: true,
  },
  {
    value: "multiple-select",
    label: "Multiple choice",
    description: "Pick one or more options from a list.",
    templateId: getTemplateIdForQuestionType("multiple-select"),
    requiresOutcomes: true,
  },
];

export function getRealityQuestionTypeOption(
  type: QuestionType
): RealityQuestionTypeOption | undefined {
  return REALITY_QUESTION_TYPES.find((t) => t.value === type);
}
