import { describe, expect, it } from 'vitest';
import { matchCannedResponse } from './canned-responses';

describe('matchCannedResponse', () => {
  it('returns a canned upload answer for upload questions', () => {
    const result = matchCannedResponse('How do I upload my first clip?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('pick a video');
  });

  it('returns upload steps when asked for steps', () => {
    const result = matchCannedResponse('What are the upload steps?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('1. Connect wallet');
    expect(result.content).not.toContain('Mixtape');
  });

  it('answers IP licensing questions without escalating', () => {
    const result = matchCannedResponse('Do I need IP licensing to upload?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('optional');
  });

  it('answers Creative TV questions without escalating', () => {
    const result = matchCannedResponse('What is Creative TV?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('Creative TV');
  });

  it('answers MeToken creation questions without escalating', () => {
    const result = matchCannedResponse('How do I create a MeToken?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('/profile');
    expect(result.content).toContain('/portfolio');
  });

  it('answers greeting/help questions without escalating', () => {
    const result = matchCannedResponse('Hello, what can you do?');
    expect(result.escalate).toBe(false);
    expect(result.content).toContain('Creative Guide');
  });

  it('escalates Mixtape questions until the feature is public', () => {
    expect(matchCannedResponse('What is Mixtape?').escalate).toBe(true);
    expect(matchCannedResponse('How does mixtape work?').escalate).toBe(true);
  });

  it('escalates unknown or advanced questions to Gemini', () => {
    expect(matchCannedResponse('advanced question').escalate).toBe(true);
    expect(matchCannedResponse('Can you explain tokenomics in detail?').escalate).toBe(
      true,
    );
    expect(matchCannedResponse('Why is the sky blue?').escalate).toBe(true);
  });
});
