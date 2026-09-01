import { describe, expect, it } from "vitest";
import { getTemplateIdForQuestionType } from "./reality-template";

describe("reality-template", () => {
  it("maps question types to standard Reality.eth template ids", () => {
    expect(getTemplateIdForQuestionType("bool")).toBe(0);
    expect(getTemplateIdForQuestionType("uint")).toBe(1);
    expect(getTemplateIdForQuestionType("single-select")).toBe(2);
    expect(getTemplateIdForQuestionType("multiple-select")).toBe(3);
  });
});
