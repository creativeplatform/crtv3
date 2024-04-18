import { Livepeer } from "livepeer";

const livepeer = new Livepeer({
  apiKey: `Bearer ${process.env.LIVEPEER_API_KEY}`,
});

export default livepeer;