import { NextRequest, NextResponse } from "next/server";
import { fetchPost } from "@lens-protocol/client/actions";
import { postId } from "@lens-protocol/client";
import type { AnyPost } from "@lens-protocol/graphql";
import { createLensClient } from "@/lib/sdk/lens/create-client";
import { parseOrbPostUrl } from "@/lib/songchain/song-cup/parse-orb-post-url";
import {
  extractPostMedia,
  postText,
  resolvePostContent,
} from "@/lib/songchain/post-utils";
import { resolveOrbMediaUrl } from "@/lib/sdk/orb/media";

export const runtime = "nodejs";

function authorLabel(post: AnyPost): string {
  const author = post.author;
  if (author.username?.localName) return author.username.localName;
  return `${author.address.slice(0, 6)}…${author.address.slice(-4)}`;
}

function serializeOrbPost(post: AnyPost) {
  const content = resolvePostContent(post);
  if (!content) return null;

  const media = extractPostMedia(content);
  const primary = media[0];
  const playbackUrl =
    primary?.type === "video" || primary?.type === "livestream"
      ? resolveOrbMediaUrl(primary.url, { type: "video" }) ?? primary.url
      : null;
  const thumbnailUrl =
    primary?.cover
      ? resolveOrbMediaUrl(primary.cover, { type: "image" }) ?? primary.cover
      : primary?.type === "image"
        ? resolveOrbMediaUrl(primary.url, { type: "image" }) ?? primary.url
        : null;

  return {
    id: content.id,
    text: postText(content),
    author: authorLabel(content),
    authorHandle: content.author.username?.localName ?? null,
    mediaType: primary?.type ?? null,
    playbackUrl,
    thumbnailUrl,
    orbUrl: `https://orb.club/p/${content.author.username?.localName ?? content.author.address}/${content.id}`,
  };
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const idParam = request.nextUrl.searchParams.get("id");

  const lensPostId = idParam ?? (urlParam ? parseOrbPostUrl(urlParam) : null);
  if (!lensPostId) {
    return NextResponse.json(
      { error: "Provide a valid Orb post URL or Lens post id." },
      { status: 400 },
    );
  }

  const apiKey = process.env.LENS_API_KEY;
  const client = createLensClient(apiKey);

  try {
    const result = await fetchPost(client, { post: postId(lensPostId) });
    if (result.isErr() || !result.value) {
      return NextResponse.json({ error: "Post not found or not indexed yet." }, { status: 404 });
    }

    const serialized = serializeOrbPost(result.value as AnyPost);
    if (!serialized) {
      return NextResponse.json({ error: "Could not read post content." }, { status: 422 });
    }

    return NextResponse.json({ post: serialized, postId: lensPostId });
  } catch {
    return NextResponse.json({ error: "Failed to load Orb post." }, { status: 500 });
  }
}
