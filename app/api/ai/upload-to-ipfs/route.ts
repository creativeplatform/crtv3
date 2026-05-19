import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { IPFSService } from '@/lib/sdk/ipfs/service';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

// Lens Grove first; optional Lighthouse if API key is set (see lib/sdk/ipfs/service.ts).
const ipfsService = new IPFSService({
  lighthouseApiKey: process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY,
  filecoinFirstApiKey: process.env.NEXT_PUBLIC_FILECOIN_FIRST_API_KEY,
  enableFilecoinArchival:
    process.env.NEXT_PUBLIC_ENABLE_FILECOIN_ARCHIVAL === 'true',
  gateway:
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    (process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY
      ? 'https://gateway.lighthouse.storage/ipfs'
      : 'https://w3s.link/ipfs'),
});

/**
 * Converts a data URL to a File object (server-side)
 */
function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a File from the buffer
    const blob = new Blob([buffer], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  } catch (error) {
    serverLogger.error('Error converting data URL to file:', error);
    return null;
  }
}

/**
 * Fetches an image from a remote URL and converts to File (server-side)
 */
async function urlToFile(url: string, filename: string): Promise<File | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blob = new Blob([buffer], { type: response.headers.get('content-type') || 'image/png' });
    
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    serverLogger.error('Error fetching image from URL:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json({
        success: false,
        error: "Invalid JSON in request body",
      }, { status: 400 });
    }
    
    const { imageUrl, filename } = body;
    
    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: "Image URL is required",
      }, { status: 400 });
    }

    // Generate filename if not provided
    const finalFilename = filename || `ai-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;

    let file: File | null = null;

    // Convert image URL to File based on type
    if (imageUrl.startsWith('data:')) {
      // Data URL (base64)
      file = dataUrlToFile(imageUrl, finalFilename);
    } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Remote URL
      file = await urlToFile(imageUrl, finalFilename);
    } else {
      return NextResponse.json({
        success: false,
        error: "Invalid image URL format. Must be data URL or HTTP/HTTPS URL",
      }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({
        success: false,
        error: "Failed to convert image URL to file",
      }, { status: 500 });
    }

    // Upload to IPFS
    const result = await ipfsService.uploadFile(file, {
      pin: true,
      wrapWithDirectory: false
    });

    if (!result.success || !result.url) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to upload to IPFS",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ipfsUrl: result.url,
      ipfsHash: result.hash,
    });

  } catch (error) {
    serverLogger.error('IPFS Upload Error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for network/connection errors
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json({
          success: false,
          error: 'Network error',
          details: 'Unable to connect to IPFS service. Please check your network connection and try again.'
        }, { status: 503 });
      }
      
      // Check for file conversion errors
      if (error.message.includes('convert') || error.message.includes('file')) {
        return NextResponse.json({
          success: false,
          error: 'File conversion error',
          details: error.message
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload to IPFS",
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

