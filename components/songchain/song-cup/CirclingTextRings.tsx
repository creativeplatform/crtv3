import type { CSSProperties } from "react";

const RING_PHRASES = [
  "Music",
  "Predict Your Winner",
  "Technology",
  "Guess Your Song",
  "Fun",
  "Community",
  "Art",
  "2026 Song Cup",
] as const;

const N_DATA = RING_PHRASES.length;

export function CirclingTextRings() {
  return (
    <div className="song-cup-hero-rings" style={{ "--n-data": N_DATA } as CSSProperties}>
      {RING_PHRASES.map((phrase, p) => (
        <div
          key={phrase}
          className="stage"
          style={
            {
              "--p": p,
              "--n-char": phrase.length,
            } as CSSProperties
          }
        >
          {[...phrase].map((char, idx) => (
            <span key={`${p}-${idx}`} style={{ "--idx": idx } as CSSProperties}>
              {char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
