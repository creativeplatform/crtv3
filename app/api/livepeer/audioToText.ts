'use server';

import type { NextApiRequest, NextApiResponse } from 'next';
import { openAsBlob } from 'node:fs';

interface AudioToTextParams {
  video: File;
  modelId?: string | null;
}

interface SubtitleEntry {
  timestamp: [number, number]; // [startTime, endTime] in seconds
  text: string;
  label?: string;
  srclang?: string;
}

function secondsToVTTTime(seconds: number): string {
  // Handle negative numbers or invalid input
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds * 1000) % 1000);

  // Format with leading zeros and ensure milliseconds has 3 digits
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(3, '0')}`;
}

function generateVTTFile(subtitles: SubtitleEntry[]): string {
  // Sort subtitles by start time to ensure proper sequence
  // const sortedSubtitles = [...subtitles].sort((a, b) => a.timestamp[0] - b.timestamp[0]);

  // Start with the WebVTT header
  let vttContent = 'WEBVTT\n\n';

  // Process each subtitle entry
  subtitles.forEach((subtitle, index) => {
    const [startTime, endTime] = subtitle.timestamp;

    // Add cue number (optional but helpful for debugging)
    vttContent += `${index + 1}\n`;

    // Add timestamp line
    vttContent += `${secondsToVTTTime(startTime)} --> ${secondsToVTTTime(endTime)}\n`;

    // Add subtitle text and blank line
    vttContent += `${subtitle.text}\n\n`;
  });

  return vttContent;
}

// Helper function to save VTT content to a file (browser environment)
async function downloadVTT(
  vttContent: string,
  filename: string = 'subtitles.vtt',
): Promise<void> {
  const blob = new Blob([vttContent], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const generateSubtitles = async (video: any) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', `Bearer ${process.env.LIVEPEER_API_KEY}`);

    const raw = JSON.stringify({
      audio: await openAsBlob(video),
    });

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow',
    };

    const response = await fetch(
      'https://dream-gateway.livepeer.cloud/audio-to-text',
      requestOptions,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Add label and srclang to each subtitle
    result.chunks = result.chunks.map((subtitle: any) => {
      subtitle.label = 'English';
      subtitle.srclang = 'en';
      return subtitle;
    });

    // Generate VTT file from chunks and append to response as vtt property
    result.vtt = generateVTTFile(result.chunks);

    return result;
  } catch (error: any) {
    console.error('Error in generateSubtitles API:', error);
    return { error: error.message || 'Internal Server Error' };
  }
};

const audioToTextHandler = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { video, model_id } = req.body;

    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', `Bearer ${process.env.LIVEPEER_API_KEY}`);

    const raw = JSON.stringify({
      audio: await openAsBlob(video),
      model_id,
    });

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow',
    };

    const response = await fetch(
      'https://dream-gateway.livepeer.cloud/audio-to-text',
      requestOptions,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in audioToText API:', error);
    return res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
};

export default audioToTextHandler;
