import { describe, expect, it } from 'vitest';
import { evaluateNsfwPredictions, type NsfwPrediction } from './useNsfwDetection';

function preds(partial: Partial<Record<'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy', number>>): NsfwPrediction[] {
  const classes = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'] as const;
  return classes.map((className) => ({
    className,
    probability: partial[className] ?? 0,
  }));
}

describe('evaluateNsfwPredictions', () => {
  it('allows safe / neutral images', () => {
    const decision = evaluateNsfwPredictions(preds({ Neutral: 0.9, Drawing: 0.05 }));
    expect(decision.action).toBe('allow');
    if (decision.action === 'allow') {
      expect(decision.reason).toBe('safe');
    }
  });

  it('blocks high-confidence Porn', () => {
    const decision = evaluateNsfwPredictions(preds({ Porn: 0.85, Neutral: 0.1 }));
    expect(decision.action).toBe('block');
    if (decision.action === 'block') {
      expect(decision.topClass).toBe('Porn');
      expect(decision.score).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('blocks high-confidence Hentai', () => {
    const decision = evaluateNsfwPredictions(preds({ Hentai: 0.72, Neutral: 0.2 }));
    expect(decision.action).toBe('block');
    if (decision.action === 'block') {
      expect(decision.topClass).toBe('Hentai');
    }
  });

  it('warns on Sexy above threshold', () => {
    const decision = evaluateNsfwPredictions(preds({ Sexy: 0.65, Neutral: 0.3 }));
    expect(decision.action).toBe('warn');
  });

  it('allows Sexy when already confirmed', () => {
    const decision = evaluateNsfwPredictions(preds({ Sexy: 0.7, Neutral: 0.2 }), {
      sexyConfirmed: true,
    });
    expect(decision.action).toBe('allow');
    if (decision.action === 'allow') {
      expect(decision.reason).toBe('confirmed_sexy');
    }
  });

  it('does not block below threshold', () => {
    const decision = evaluateNsfwPredictions(preds({ Porn: 0.4, Neutral: 0.5 }));
    expect(decision.action).toBe('allow');
  });
});
