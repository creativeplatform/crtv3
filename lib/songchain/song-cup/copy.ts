/** Song Cup contest website copy and attestation terms (single source of truth). */

export const SONG_CUP_HERO = {
  headline: "Song Cup: Where Music Meets the World's Game.",
  intro:
    "Song Cup is an audio-visual competition celebrating the passion, unity, and energy of the World Cup. We invite artists, songwriters, and creators to transform their original music into immersive storytelling using Pixel AI by Creative Platform.",
  collaboration: "A collaboration by Creative Platform, Orb, and Polvinyl.",
} as const;

export const SONG_CUP_HOW_IT_WORKS = [
  {
    title: "Create",
    body: "Compose or select your 100% original music track.",
  },
  {
    title: "Generate",
    body: "Use Pixels by Creative Platform to create a stunning visual narrative for your music.",
  },
  {
    title: "Produce",
    body: "Combine your track and visuals into a final music video (30–60 seconds).",
  },
  {
    title: "Submit",
    body: "Upload your final entry via the Submission Tab. (No DMs or social media posts will be accepted.)",
  },
] as const;

export const SONG_CUP_BATTLE_STAGE = {
  title: "The Battle Stage (Voting Process)",
  paragraphs: [
    "Once submissions close, our judge panel will select the Top 20 finalists based on creativity, originality, musical quality, and technical execution.",
    "These finalists will advance to the Song Cup Battle Stage, an official tournament-style bracket. Fans will view the matchups and cast votes for their favorite artists. The winner of each head-to-head battle advances to the next round until the last standing artist is crowned the Song Cup Champion.",
  ],
} as const;

export const SONG_CUP_WHY_PARTICIPATE = {
  title: "Why Participate?",
  items: [
    {
      label: "Global Exposure",
      body: "Showcase your music to a worldwide audience.",
    },
    {
      label: "Innovation",
      body: "Experiment with cutting-edge AI visual tools, even if you have no prior video production experience.",
    },
    {
      label: "Ecosystem Growth",
      body: "Gain visibility across the Creative Platform ecosystem.",
    },
    {
      label: "Community",
      body: "Be part of a movement where music, technology, and storytelling collide.",
    },
  ],
} as const;

export const SONG_CUP_CONTEST_REQUIREMENTS = {
  title: "Contest Requirements",
  items: [
    "Music must be 100% original and owned by the participant (no AI-generated music).",
    "Videos must be created using Pixels by Creative Platform.",
    "Video length must be exactly 30 to 60 seconds.",
    "Entries must align with the World Cup theme and comply with community guidelines.",
  ],
} as const;

export const SONG_CUP_ATTESTATION_TERMS_SECTIONS = [
  {
    title: "Submission & Content Rules",
    body: [
      "Duration: Entries must strictly be between 30 and 60 seconds. Any other length will be disqualified.",
      "Tooling: All video visuals must be generated explicitly using Pixels.",
      "Format: High-definition .mp4 (1080p or 4K) is preferred.",
      "Theme & Safety: Content must celebrate the spirit of the World Cup. Videos must be free of harmful, explicit, or offensive content.",
      "Age Requirement: Participants must be 18 years or older.",
    ],
  },
  {
    title: "Music & Copyright Requirements",
    body: [
      "Originality: The music must be 100% original, composed, and owned by the participant. AI-generated music is strictly prohibited.",
      "Copyright Compliance: Do not use copyrighted samples, third-party music, or imitations of famous artists' voices. Violations will result in immediate disqualification, removal of the track, and a platform ban.",
    ],
  },
  {
    title: "IP & Usage Rights",
    body: [
      "Artist Ownership: You retain 100% of the copyright to your original intellectual property (IP).",
      "Platform License: By submitting, you grant the platform a worldwide, non-exclusive, royalty-free license to host, display, and stream the entry on Creative TV, Orb, decentralized networks, and social channels for 3 months from submission for promotional purposes.",
      "Commercial Distribution: The platform reserves the right to package or stream the music on commercial platforms (like Spotify or Apple Music) for corporate profit without a separate revenue-share agreement.",
      "Compilation Releases: Winning entries may be included in a physical or digital compilation. This requires a separate, mutually agreed-upon revenue split contract before release.",
      "No AI Training: The platform will not use submitted works to train machine learning or generative AI models without explicit, written opt-in consent.",
    ],
  },
  {
    title: "Wallet Connection & Data Ownership",
    body: [
      "Wallet as Identity: Connecting a digital wallet serves as your electronic signature. You are solely responsible for your private keys.",
      "Public Data (On-Chain): Interaction data (submission timestamps, voting records, wallet addresses) logged on the blockchain is permanent, immutable, and public.",
      "Private Data (Off-Chain): Traditional data (emails, legal names) is managed under standard privacy laws (e.g., GDPR) and can be requested for deletion.",
    ],
  },
  {
    title: "Warranties & Indemnification",
    body: [
      "Warranties: You guarantee your submission is 100% original and does not infringe on any third-party rights.",
      "Indemnification: If you submit unauthorized copyrighted material that results in legal action against the platform, you agree to cover all resulting legal costs and damages. The platform holds no liability for compromised wallets or smart contract failures.",
    ],
  },
] as const;

export const SONG_CUP_ATTESTATION_CERTIFICATION =
  "I have read and agree to the Song Cup Contest Terms & Conditions. I confirm I am 18 or older, my music is 100% original (not AI-generated music), my video visuals were created with Pixels, my entry is 30–60 seconds, and I meet all contest requirements. I retain ownership of my IP and understand the platform license, warranties, and indemnification terms above.";
