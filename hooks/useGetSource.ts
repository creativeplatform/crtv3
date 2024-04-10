// this is a server function, which uses the API key
// on the backend
import { Livepeer } from "livepeer"
import { getSrc } from "@livepeer/react/external";

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY
})

export async function getSourceForPlaybackId(playbackId: string) {
  const response = await livepeer.playback.get(playbackId);

  // the return value can be passed directly to the Player as `src`
  return getSrc(response.playbackInfo);
}
