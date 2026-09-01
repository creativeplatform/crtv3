'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PredictionType } from 'nsfwjs';
import { logger } from '@/lib/utils/logger';

const BLOCK_THRESHOLD = 0.6;
const WARN_THRESHOLD = 0.6;

export type NsfwPrediction = PredictionType;

export type NsfwGateDecision =
  | { action: 'allow'; predictions: NsfwPrediction[]; reason: 'safe' | 'model_unavailable' | 'confirmed_sexy' }
  | { action: 'block'; predictions: NsfwPrediction[]; topClass: string; score: number }
  | { action: 'warn'; predictions: NsfwPrediction[]; score: number };

export type NsfwClassifyResult = {
  predictions: NsfwPrediction[];
  /** True when we skipped or failed model load (fail-open). */
  failedOpen: boolean;
  error?: string;
};

type WorkerResultMessage = {
  type: 'result';
  id: string;
  predictions: NsfwPrediction[];
};

type WorkerErrorMessage = {
  type: 'error';
  id?: string;
  message: string;
};

type WorkerReadyMessage = { type: 'ready' };

type WorkerOutMessage = WorkerResultMessage | WorkerErrorMessage | WorkerReadyMessage;

function sortPredictions(predictions: NsfwPrediction[]): NsfwPrediction[] {
  return [...predictions].sort((a, b) => b.probability - a.probability);
}

/**
 * Apply Creative TV v1 NSFW policy to classifier output.
 * Caller handles UX for `warn` (confirm) and `block`.
 */
export function evaluateNsfwPredictions(
  predictions: NsfwPrediction[],
  options?: { sexyConfirmed?: boolean }
): NsfwGateDecision {
  const sorted = sortPredictions(predictions);
  const top = sorted[0];
  if (!top) {
    return { action: 'allow', predictions: sorted, reason: 'safe' };
  }

  const porn = sorted.find((p) => p.className === 'Porn');
  const hentai = sorted.find((p) => p.className === 'Hentai');
  const sexy = sorted.find((p) => p.className === 'Sexy');

  const blockScore = Math.max(porn?.probability ?? 0, hentai?.probability ?? 0);
  if (blockScore >= BLOCK_THRESHOLD) {
    const topClass =
      (porn?.probability ?? 0) >= (hentai?.probability ?? 0) ? 'Porn' : 'Hentai';
    return {
      action: 'block',
      predictions: sorted,
      topClass,
      score: blockScore,
    };
  }

  if ((sexy?.probability ?? 0) >= WARN_THRESHOLD) {
    if (options?.sexyConfirmed) {
      return { action: 'allow', predictions: sorted, reason: 'confirmed_sexy' };
    }
    return {
      action: 'warn',
      predictions: sorted,
      score: sexy!.probability,
    };
  }

  return { action: 'allow', predictions: sorted, reason: 'safe' };
}

async function sourceToImageBitmap(
  source: File | Blob | ImageBitmap | string
): Promise<ImageBitmap> {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return source;
  }
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch image for NSFW check (${res.status})`);
    }
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  return createImageBitmap(source);
}

function failOpenResult(error?: string): NsfwClassifyResult {
  if (error) {
    logger.warn('[nsfw] fail-open:', error);
  }
  return { predictions: [], failedOpen: true, error };
}

export function useNsfwDetection() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<
    Map<
      string,
      {
        resolve: (value: NsfwClassifyResult) => void;
        reject: (reason?: unknown) => void;
      }
    >
  >(new Map());
  const isModelUnavailableRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isModelUnavailable, setIsModelUnavailable] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const initAttemptedRef = useRef(false);

  const markModelUnavailable = useCallback((error?: string): NsfwClassifyResult => {
    isModelUnavailableRef.current = true;
    setIsModelUnavailable(true);
    setIsReady(false);
    return failOpenResult(error);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || initAttemptedRef.current) {
      return;
    }
    initAttemptedRef.current = true;

    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../workers/nsfw-detection.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      logger.warn('[nsfw] Worker construction failed', err);
      markModelUnavailable('NSFW worker construction failed');
      return;
    }

    workerRef.current = worker;

    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (data.type === 'ready') {
        isModelUnavailableRef.current = false;
        setIsReady(true);
        setIsModelUnavailable(false);
        return;
      }
      if (data.type === 'error' && !data.id) {
        markModelUnavailable(data.message);
        logger.warn('[nsfw] model load error:', data.message);
        return;
      }
      if (data.type === 'result' || (data.type === 'error' && data.id)) {
        const id = data.type === 'result' ? data.id : data.id!;
        const pending = pendingRef.current.get(id);
        if (!pending) return;
        pendingRef.current.delete(id);
        if (pendingRef.current.size === 0) {
          setIsClassifying(false);
        }
        if (data.type === 'result') {
          pending.resolve({
            predictions: sortPredictions(data.predictions),
            failedOpen: false,
          });
        } else {
          // Per-image failure only — do not disable the model for later uploads
          pending.resolve(failOpenResult(data.message));
        }
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', (err) => {
      logger.warn('[nsfw] worker error', err);
      const result = markModelUnavailable('NSFW worker crashed');
      for (const [id, pending] of Array.from(pendingRef.current.entries())) {
        pending.resolve(result);
        pendingRef.current.delete(id);
      }
      setIsClassifying(false);
    });

    worker.postMessage({ type: 'init' });

    return () => {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, [markModelUnavailable]);

  const classify = useCallback(
    async (source: File | Blob | ImageBitmap | string): Promise<NsfwClassifyResult> => {
      const worker = workerRef.current;
      if (isModelUnavailableRef.current) {
        return failOpenResult('NSFW model unavailable');
      }
      if (!worker) {
        // Worker still initializing — fail this request only; keep trying later
        return failOpenResult('NSFW worker not ready');
      }

      let bitmap: ImageBitmap;
      try {
        bitmap = await sourceToImageBitmap(source);
      } catch (err) {
        return failOpenResult(err instanceof Error ? err.message : 'Failed to decode image');
      }

      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `nsfw-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setIsClassifying(true);

      return new Promise<NsfwClassifyResult>((resolve) => {
        const timeout = window.setTimeout(() => {
          pendingRef.current.delete(id);
          try {
            bitmap.close();
          } catch {
            // already transferred
          }
          if (pendingRef.current.size === 0) {
            setIsClassifying(false);
          }
          // Timeout is per-request — do not disable the model globally
          resolve(failOpenResult('NSFW classification timed out'));
        }, 30_000);

        pendingRef.current.set(id, {
          resolve: (value) => {
            window.clearTimeout(timeout);
            resolve(value);
          },
          reject: () => {
            window.clearTimeout(timeout);
            resolve(failOpenResult('NSFW classification rejected'));
          },
        });

        try {
          worker.postMessage({ type: 'classify', id, bitmap }, [bitmap]);
        } catch (err) {
          window.clearTimeout(timeout);
          pendingRef.current.delete(id);
          try {
            bitmap.close();
          } catch {
            // ignore
          }
          if (pendingRef.current.size === 0) {
            setIsClassifying(false);
          }
          resolve(failOpenResult(err instanceof Error ? err.message : 'Failed to post to NSFW worker'));
        }
      });
    },
    []
  );

  /**
   * Classify then apply gate policy.
   * For `warn`, prompts the user once; if they confirm, returns allow.
   * Fail-open when the model is unavailable.
   */
  const gateImage = useCallback(
    async (
      source: File | Blob | ImageBitmap | string,
      options?: { confirmSexy?: (score: number) => boolean | Promise<boolean> }
    ): Promise<NsfwGateDecision> => {
      const result = await classify(source);
      if (result.failedOpen) {
        return {
          action: 'allow',
          predictions: result.predictions,
          reason: 'model_unavailable',
        };
      }

      const decision = evaluateNsfwPredictions(result.predictions);
      if (decision.action !== 'warn') {
        return decision;
      }

      const confirm =
        options?.confirmSexy ??
        ((score: number) =>
          window.confirm(
            `This image may be suggestive (score ${(score * 100).toFixed(0)}%). Continue with this thumbnail?`
          ));

      const confirmed = await confirm(decision.score);
      if (confirmed) {
        return {
          action: 'allow',
          predictions: decision.predictions,
          reason: 'confirmed_sexy',
        };
      }
      return decision;
    },
    [classify]
  );

  return {
    classify,
    gateImage,
    evaluateNsfwPredictions,
    isReady,
    isModelUnavailable,
    isClassifying,
  };
}
