import { PinataApiError } from "@/lib/pinata/api";

export function mapSongCupAgentError(err: unknown): string {
  if (err instanceof PinataApiError) {
    if (err.status === 401) {
      return "Pinata JWT was rejected. Regenerate your API key and update PINATA_JWT on Vercel.";
    }
    if (err.status === 503) {
      return "Pinata management API is unavailable. Copy a fresh gateway token from the agent Danger tab into SONG_CUP_PINATA_GATEWAY_TOKEN, then redeploy.";
    }
    if (err.status === 404) {
      return "Song Cup Pinata agent was not found. Check SONG_CUP_PINATA_AGENT_ID and your Pinata account.";
    }
    return err.message;
  }

  const msg = err instanceof Error ? err.message : "Agent unreachable";

  if (msg.toLowerCase().includes("pinata agent chat timed out")) {
    return `${msg} The agent may still be starting — try again in a few seconds.`;
  }

  if (msg.toLowerCase().includes("pairing")) {
    return msg;
  }

  if (msg.toLowerCase().includes("missing scope")) {
    return msg;
  }

  return msg;
}
