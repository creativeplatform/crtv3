import { describe, expect, it } from "vitest";
import {
  parsePredictionDisplay,
  answerBytesToLabel,
  applyPredictionMetadataOverride,
  isSongchainCategory,
} from "./parse-prediction-display";

describe("parsePredictionDisplay", () => {
  it("parses unit-separated question text", () => {
    const raw =
      'Will it rain tomorrow?\u241f"Yes","No"\u241fcreative tv\u241fen_US';
    const parsed = parsePredictionDisplay(raw);
    expect(parsed.title).toBe("Will it rain tomorrow?");
    expect(parsed.outcomes).toContain("Yes");
    expect(parsed.category.toLowerCase()).toContain("creative");
  });

  it("parses bool template id 0", () => {
    const raw = 'Will it rain?\u241fgeneral\u241fen_US';
    const parsed = parsePredictionDisplay(raw, 0);
    expect(parsed.type).toBe("bool");
    expect(parsed.title).toBe("Will it rain?");
  });

  it("parses uint template id 1", () => {
    const raw = 'How many views?\u241fgeneral\u241fen_US';
    const parsed = parsePredictionDisplay(raw, 1);
    expect(parsed.type).toBe("uint");
    expect(parsed.title).toBe("How many views?");
  });

  it("maps bool answers", () => {
    const parsed = parsePredictionDisplay("Test?\u241f\u241fgeneral\u241fen_US");
    expect(answerBytesToLabel(
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      parsed
    )).toBe("Yes");
    expect(answerBytesToLabel(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      parsed
    )).toBe("No");
  });

  it("decodes uint answer even when parsed type was mis-inferred as bool", () => {
    const parsed = parsePredictionDisplay("Test?\u241f\u241fgeneral\u241fen_US");
    expect(parsed.type).toBe("bool");
    expect(
      answerBytesToLabel(
        "0x0000000000000000000000000000000000000000000000000000000000000005",
        parsed
      )
    ).toBe("5");
  });

  it("returns null for unresolved non-boolean zero answer", () => {
    const parsed = parsePredictionDisplay(
      'Pick one?\u241f"A","B","C"\u241fgeneral\u241fen_US'
    );
    expect(answerBytesToLabel(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      parsed
    )).toBeNull();
  });

  it("applies metadata override for badly formatted titles", () => {
    const parsed = parsePredictionDisplay(
      "[Badly formatted question]: usususus",
      0
    );
    const updated = applyPredictionMetadataOverride(parsed, {
      title: "How many streams?",
      questionType: "uint",
    });
    expect(updated.title).toBe("How many streams?");
    expect(updated.type).toBe("uint");
    expect(updated.outcomes).toEqual([]);
    expect(
      answerBytesToLabel(
        "0x0000000000000000000000000000000000000000000000000000000000000005",
        updated,
        updated.type
      )
    ).toBe("5");
  });

  it("detects songchain category", () => {
    expect(isSongchainCategory("songchain")).toBe(true);
    expect(isSongchainCategory("creative tv")).toBe(false);
  });

  it("parses bool question with template_id 0", () => {
    const raw =
      "Will the album drop this week?\u241fcreative tv\u241fen_US";
    const parsed = parsePredictionDisplay(raw, 0);
    expect(parsed.title).toBe("Will the album drop this week?");
    expect(parsed.category).toBe("creative tv");
    expect(parsed.type).toBe("bool");
    expect(parsed.title).not.toContain("[Badly formatted question]");
  });

  it("parses single-select question with template_id 2", () => {
    const raw = 'Who wins?\u241f"Alice","Bob"\u241fgeneral\u241fen_US';
    const parsed = parsePredictionDisplay(raw, 2);
    expect(parsed.title).toBe("Who wins?");
    expect(parsed.outcomes).toEqual(["Alice", "Bob"]);
    expect(parsed.type).toBe("single-select");
    expect(parsed.title).not.toContain("[Badly formatted question]");
  });

  it("parses bool question with template_id as bigint", () => {
    const raw = "Test question?\u241fgeneral\u241fen_US";
    const parsed = parsePredictionDisplay(raw, BigInt(0));
    expect(parsed.title).toBe("Test question?");
    expect(parsed.title).not.toContain("[Badly formatted question]");
  });

  it("maps ordinal answer to outcome label when outcomes exist", () => {
    const parsed = parsePredictionDisplay(
      'Pick a movie?\u241f"Movie A","Movie B","Movie C","Movie D","Movie E"\u241fgeneral\u241fen_US',
      2
    );
    expect(
      answerBytesToLabel(
        "0x0000000000000000000000000000000000000000000000000000000000000005",
        parsed
      )
    ).toBe("Movie E");
  });

  it("applies metadata outcomes override", () => {
    const parsed = parsePredictionDisplay("Test?\u241fgeneral\u241fen_US", 0);
    const updated = applyPredictionMetadataOverride(parsed, {
      outcomes: ["Alpha", "Beta", "Gamma"],
      questionType: "single-select",
    });
    expect(updated.outcomes).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(updated.type).toBe("single-select");
  });
});
