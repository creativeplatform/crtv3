/**
 * Canned response layer for OrbGuide.
 *
 * Keeps routine onboarding/upload questions cheap and fast by matching them
 * to pre-written answers. Only unmatched or explicitly advanced queries are
 * escalated to the paid Gemini model.
 */

export interface CannedMatch {
  /** If true, the caller should stream a Gemini response instead. */
  escalate: boolean;
  content?: string;
  action?: {
    type: 'reveal_dropzone' | 'explain_steps';
    steps?: string[];
  };
}

const UPLOAD_STEPS = [
  'Connect wallet (already done via Orb/Privy).',
  'Pick a video file to upload.',
  'Add a title, description, and tags.',
  'Optionally attach IP licensing — not required to publish.',
  'Hit Publish. Your clip goes live and is mintable.',
];

const MIXTAPE_NOTE =
  'Mixtape curation is open to ALL users and is NEVER gated on IP licensing.';

/** Common question patterns and their exact canned answers. */
const PATTERNS: { patterns: string[]; response: string }[] = [
  {
    patterns: [
      'how do i upload',
      'how to upload',
      'upload my first clip',
      'upload a video',
      'start upload',
      'publish a clip',
      'post a video',
      'how does upload work',
      'upload guide',
    ],
    response:
      'Uploading is easy: pick a video, add title/description/tags, optionally attach IP licensing, then hit Publish. ' +
      'IP licensing is optional — your clip goes live either way.',
  },
  {
    patterns: [
      'what are the upload steps',
      'upload steps',
      'steps to upload',
      'walk me through upload',
      'explain upload flow',
      'how does uploading work',
    ],
    response: `Here are the steps:\n${UPLOAD_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${MIXTAPE_NOTE}`,
  },
  {
    patterns: [
      'do i need ip licensing',
      'is ip required',
      'do i need ip to upload',
      'is ip licensing mandatory',
      'what is ip licensing',
      'explain ip licensing',
    ],
    response:
      'IP licensing is **optional**. You can publish clips without it. It helps protect and monetize your work, but it is never required to upload or appear on Mixtape.',
  },
  {
    patterns: [
      'what is mixtape',
      'how does mixtape work',
      'who can use mixtape',
      'mixtape requirements',
      'curate mixtape',
    ],
    response:
      'Mixtape lets anyone curate and share video playlists. ' +
      'It is open to all users and does not require IP licensing or a paid membership.',
  },
  {
    patterns: [
      'how do i mint',
      'what is minting',
      'mint my clip',
      'how to mint video',
      'do i need to mint',
    ],
    response:
      'Minting turns your clip into an on-chain digital asset. It is optional after upload. If you want to sell, license, or prove ownership, you can mint from the clip page or during upload.',
  },
  {
    patterns: [
      'what is creative platform',
      'what is crtv',
      'what is creative tv',
      'who are you',
      'what can you do',
      'help',
      'hello',
      'hi',
      'hey',
    ],
    response:
      "I'm Creative Guide. I can walk you through uploading, explain Mixtape, IP licensing, minting, memberships, and more. Ask me anything or tap 'Start my first upload'.",
  },
  {
    patterns: [
      'what is membership',
      'how do memberships work',
      'join membership',
      'membership benefits',
      'do i need a membership',
    ],
    response:
      'Memberships unlock extra features like gated content, badges, and creator perks. They are optional — you can upload and use Mixtape without one.',
  },
  {
    patterns: [
      'wallet not working',
      'connect wallet failed',
      'wallet error',
      'privy not working',
      'orb login not working',
      'why is my wallet not connecting',
    ],
    response:
      'Make sure you complete the Orb/Privy sign-in popup. If it is blocked, check your browser for pop-up blockers. Still stuck? Try refreshing the page and signing in again.',
  },
  {
    patterns: [
      'how much does it cost',
      'is this free',
      'do i pay',
      'upload cost',
      'chat cost',
      'why do i need to pay',
    ],
    response:
      'Uploading and using Mixtape are free. Advanced agent chats that need the hosted AI cost a small USDC payment per message.',
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a user message against the canned response bank.
 * Returns a canned answer or signals escalation to the paid model.
 */
export function matchCannedResponse(message: string): CannedMatch {
  const normalized = normalize(message);

  for (const item of PATTERNS) {
    for (const pattern of item.patterns) {
      // Whole-word-ish substring match; good enough for short onboarding queries.
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        return { escalate: false, content: item.response };
      }
    }
  }

  // Explicit escalation cue.
  if (/(advanced|detailed|deep|expert|ask the ai|ask gemini)/.test(normalized)) {
    return { escalate: true };
  }

  // No match — escalate to the paid model.
  return { escalate: true };
}

export { UPLOAD_STEPS };
