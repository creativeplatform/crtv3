import type { AnyClient } from '@lens-protocol/client';
import { fetchPost } from '@lens-protocol/client/actions';
import { postId } from '@lens-protocol/client';
import type { AnyPost } from '@lens-protocol/graphql';

const POLL_DELAYS_MS = [2_000, 5_000, 10_000, 15_000] as const;

export async function waitForPostIndexed(
  client: AnyClient,
  id: string,
  options?: { signal?: AbortSignal },
): Promise<AnyPost | null> {
  const delays = [0, ...POLL_DELAYS_MS];

  for (const delay of delays) {
    if (options?.signal?.aborted) return null;
    if (delay > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        options?.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      }).catch(() => null);
      if (options?.signal?.aborted) return null;
    }

    try {
      const result = await fetchPost(client, { post: postId(id) });
      if (result.isOk() && result.value) {
        return result.value as AnyPost;
      }
    } catch {
      // Indexer may not have the post yet
    }
  }

  return null;
}
