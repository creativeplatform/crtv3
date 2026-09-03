import { GoogleGenAI, Type } from "@google/genai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { DetectionResultArraySchema } from "@/lib/validations/campaign";
import { serverLogger } from "@/lib/utils/logger";

export interface DetectionResult {
  startTime: number;
  endTime: number;
  boundingBox: [number, number, number, number];
}

function getAiClient() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

async function downloadToFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  // Node fetch body is a web ReadableStream; convert for pipeline.
  const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  await pipeline(nodeStream, fs.createWriteStream(dest));
}

function guessImageMime(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".webp")) return "image/webp";
  return "image/png";
}

function clampBBox(box: number[]): [number, number, number, number] {
  const clamped = box.slice(0, 4).map((c) =>
    Math.min(1000, Math.max(0, Math.round(Number(c) || 0)))
  );
  while (clamped.length < 4) clamped.push(0);
  return clamped as [number, number, number, number];
}

export async function detectProductInVideo(
  videoDownloadUrl: string,
  productImageUrl: string
): Promise<DetectionResult[]> {
  const ai = getAiClient();
  const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL ?? "gemini-2.5-flash";
  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `shoppable-video-${Date.now()}.mp4`);
  const imagePath = path.join(
    tmpDir,
    `shoppable-product-${Date.now()}.${guessImageMime(productImageUrl).split("/")[1]}`
  );

  let videoFileName: string | undefined;
  let imageFileName: string | undefined;

  try {
    await Promise.all([
      downloadToFile(videoDownloadUrl, videoPath),
      downloadToFile(productImageUrl, imagePath),
    ]);

    const [videoFile, imageFile] = await Promise.all([
      ai.files.upload({
        file: videoPath,
        config: { mimeType: "video/mp4" },
      }),
      ai.files.upload({
        file: imagePath,
        config: { mimeType: guessImageMime(productImageUrl) },
      }),
    ]);

    videoFileName = videoFile.name;
    imageFileName = imageFile.name;

    let file = await ai.files.get({ name: videoFile.name! });
    while (file.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      file = await ai.files.get({ name: videoFile.name! });
    }
    if (file.state !== "ACTIVE") {
      throw new Error(`Video file state returned: ${file.state}`);
    }

    const response = await ai.models.generateContent({
      model: VIDEO_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: videoFile.uri,
                mimeType: videoFile.mimeType || "video/mp4",
              },
            },
            {
              fileData: {
                fileUri: imageFile.uri,
                mimeType: imageFile.mimeType || guessImageMime(productImageUrl),
              },
            },
            {
              text: "Locate the product shown in the image inside this video. Return a JSON array with all continuous timestamp intervals where the product is visible, including the 2D bounding box normalized 0 to 1000 [ymin, xmin, ymax, xmax].",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: { type: Type.NUMBER },
              endTime: { type: Type.NUMBER },
              boundingBox: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "[ymin, xmin, ymax, xmax] normalized 0-1000",
              },
            },
            required: ["startTime", "endTime", "boundingBox"],
          },
        },
      },
    });

    const raw = JSON.parse(response.text || "[]");
    const parsed = DetectionResultArraySchema.safeParse(raw);
    if (!parsed.success) {
      serverLogger.warn("[detectProductInVideo] schema mismatch", parsed.error);
      throw new Error("Gemini returned invalid detection schema");
    }

    return parsed.data
      .filter((item) => item.endTime >= item.startTime)
      .map((item) => ({
        startTime: Math.max(0, item.startTime),
        endTime: Math.max(item.startTime, item.endTime),
        boundingBox: clampBBox(item.boundingBox),
      }));
  } finally {
    await Promise.allSettled([
      videoFileName
        ? ai.files.delete({ name: videoFileName })
        : Promise.resolve(),
      imageFileName
        ? ai.files.delete({ name: imageFileName })
        : Promise.resolve(),
    ]);
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    } catch {
      /* ignore */
    }
  }
}
