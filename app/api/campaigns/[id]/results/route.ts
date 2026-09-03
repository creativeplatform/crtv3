import { NextRequest, NextResponse } from "next/server";
import { gql } from "@apollo/client";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { makeServerClient } from "@/lib/apollo-server-client";

/**
 * GET /api/campaigns/[id]/results
 *
 * Public read of a Snapshot proposal's live results — the resolution source
 * for campaign predictions (choice scores, total votes, state). No auth.
 * Campaigns are public Snapshot data; this endpoint simply proxies the hub
 * query with our rate limiting/BotID posture.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json(
      { error: "Valid campaign (proposal) id is required" },
      { status: 400 }
    );
  }

  try {
    const client = makeServerClient();
    const { data, error } = await client.query<{
      proposal: {
        id: string;
        title: string;
        choices: string[];
        scores: number[];
        scores_total: number;
        votes: number;
        state: string;
        end: number;
      } | null;
    }>({
      query: gql`
        query($id: String!) {
          proposal(id: $id) {
            id
            title
            choices
            scores
            scores_total
            votes
            state
            end
          }
        }
      `,
      variables: { id },
      fetchPolicy: "no-cache",
    });

    if (error || !data?.proposal) {
      // Distinguish a real miss (404) from a hub/transport failure (502) so
      // callers polling this endpoint (campaign presets, future strips) don't
      // treat a transient Snapshot outage as "campaign gone".
      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch campaign results" },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const p = data.proposal;
    const scores = Array.isArray(p.scores) ? p.scores : [];
    const choices: string[] = Array.isArray(p.choices) ? p.choices : [];
    let leadingChoice: string | null = null;
    let leadingScore = -1;
    choices.forEach((choice, idx) => {
      const score = Number(scores?.[idx] ?? 0);
      if (score > leadingScore) {
        leadingScore = score;
        leadingChoice = choice;
      }
    });

    return NextResponse.json({
      campaignId: p.id,
      title: p.title,
      state: p.state,
      choices,
      scores,
      totalVotingPower: p.scores_total ?? 0,
      totalVotes: p.votes ?? 0,
      leadingChoice,
      end: p.end,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch campaign results" },
      { status: 502 }
    );
  }
}