/**
 * NSFW classification Web Worker (nsfwjs + TensorFlow.js).
 * Loads MobileNetV2 from same-origin /models/nsfw/ — no Hugging Face CDN.
 */

import * as tf from '@tensorflow/tfjs';
import { load, type NSFWJS, type PredictionType } from 'nsfwjs';

const MODEL_URL = '/models/nsfw/';

type InitMessage = { type: 'init' };
type ClassifyMessage = {
  type: 'classify';
  id: string;
  bitmap: ImageBitmap;
};
type WorkerInMessage = InitMessage | ClassifyMessage;

type ReadyMessage = { type: 'ready' };
type ResultMessage = {
  type: 'result';
  id: string;
  predictions: PredictionType[];
};
type ErrorMessage = {
  type: 'error';
  id?: string;
  message: string;
};
type WorkerOutMessage = ReadyMessage | ResultMessage | ErrorMessage;

let model: NSFWJS | null = null;
let loading: Promise<void> | null = null;

async function ensureModel(): Promise<NSFWJS> {
  if (model) return model;
  if (!loading) {
    loading = (async () => {
      await tf.ready();
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }
      model = await load(MODEL_URL);
    })();
  }
  await loading;
  if (!model) {
    throw new Error('NSFW model failed to initialize');
  }
  return model;
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;

  if (data.type === 'init') {
    try {
      await ensureModel();
      const msg: WorkerOutMessage = { type: 'ready' };
      self.postMessage(msg);
    } catch (err) {
      const msg: WorkerOutMessage = {
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load NSFW model',
      };
      self.postMessage(msg);
    }
    return;
  }

  if (data.type === 'classify') {
    const { id, bitmap } = data;
    try {
      const nsfwModel = await ensureModel();
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('OffscreenCanvas 2D context unavailable');
      }
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close();
      const predictions = await nsfwModel.classify(imageData);
      const msg: WorkerOutMessage = { type: 'result', id, predictions };
      self.postMessage(msg);
    } catch (err) {
      try {
        bitmap.close();
      } catch {
        // ignore
      }
      const msg: WorkerOutMessage = {
        type: 'error',
        id,
        message: err instanceof Error ? err.message : 'NSFW classification failed',
      };
      self.postMessage(msg);
    }
  }
};

export {};
