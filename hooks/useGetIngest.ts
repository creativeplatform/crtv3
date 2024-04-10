// this is a server function, which uses the API key
// on the backend
import { Livepeer } from "livepeer"
import { getIngest } from "@livepeer/react/external";

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY
})

export async function getIngestUrlForStreamId(streamId: string) {
  const stream = await livepeer.stream.get(streamId);

  // the return value can be passed directly to the Broadcast as `ingestUrl`
  return getIngest(stream.stream);
}
