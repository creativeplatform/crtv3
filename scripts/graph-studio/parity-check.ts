/* eslint-disable no-console */
type GraphResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function query<T>(url: string, queryText: string): Promise<GraphResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: queryText })
  });
  return res.json();
}

function compareCounts(label: string, left: number, right: number): void {
  const status = left === right ? "MATCH" : "DIFF";
  console.log(`${status} ${label}: goldsky=${left} studio=${right}`);
}

async function main() {
  const goldskyMeTokensUrl = process.env.GOLDSKY_METOKENS_URL;
  const goldskyRealityUrl = process.env.GOLDSKY_REALITY_ETH_URL;
  const studioUrl = process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL;

  if (!goldskyMeTokensUrl || !goldskyRealityUrl || !studioUrl) {
    throw new Error("Set GOLDSKY_METOKENS_URL, GOLDSKY_REALITY_ETH_URL, GRAPH_STUDIO_CREATIVE_PLATFORM_URL");
  }

  const meTokenQuery = `{
    subscribes(first: 20) { id }
    mints(first: 20) { id }
    burns(first: 20) { id }
  }`;

  const realityQuery = `{
    questions(first: 20) { id }
    answers(first: 20) { id }
  }`;

  const [goldskyMeTokens, studioMeTokens, goldskyReality, studioReality] = await Promise.all([
    query<{ subscribes: Array<{ id: string }>; mints: Array<{ id: string }>; burns: Array<{ id: string }> }>(goldskyMeTokensUrl, meTokenQuery),
    query<{ subscribes: Array<{ id: string }>; mints: Array<{ id: string }>; burns: Array<{ id: string }> }>(studioUrl, meTokenQuery),
    query<{ questions: Array<{ id: string }>; answers: Array<{ id: string }> }>(goldskyRealityUrl, realityQuery),
    query<{ questions: Array<{ id: string }>; answers: Array<{ id: string }> }>(studioUrl, realityQuery)
  ]);

  if (goldskyMeTokens.errors || studioMeTokens.errors || goldskyReality.errors || studioReality.errors) {
    console.error("GraphQL errors detected:", {
      goldskyMeTokens: goldskyMeTokens.errors,
      studioMeTokens: studioMeTokens.errors,
      goldskyReality: goldskyReality.errors,
      studioReality: studioReality.errors
    });
    process.exit(1);
  }

  compareCounts("subscribes", goldskyMeTokens.data?.subscribes.length ?? 0, studioMeTokens.data?.subscribes.length ?? 0);
  compareCounts("mints", goldskyMeTokens.data?.mints.length ?? 0, studioMeTokens.data?.mints.length ?? 0);
  compareCounts("burns", goldskyMeTokens.data?.burns.length ?? 0, studioMeTokens.data?.burns.length ?? 0);
  compareCounts("questions", goldskyReality.data?.questions.length ?? 0, studioReality.data?.questions.length ?? 0);
  compareCounts("answers", goldskyReality.data?.answers.length ?? 0, studioReality.data?.answers.length ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
