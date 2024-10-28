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

export function generateVTTFile(subtitles: SubtitleEntry[]): string {
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

// Example usage:
const subtitleData: SubtitleEntry[] = [
  {
    timestamp: [0, 2.5],
    text: 'Hello, welcome to this video!',
  },
  {
    timestamp: [2.5, 5.0],
    text: "Today we'll learn about WebVTT",
  },
  {
    timestamp: [5.0, 8.2],
    text: "It's a format for displaying timed text",
  },
];
