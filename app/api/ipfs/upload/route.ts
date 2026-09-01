import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { groveService } from '@/lib/sdk/grove/service';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
    const verification = await checkBotIdDeep();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    const rl = await rateLimiters.standard(request);
    if (rl) return rl;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }

        // Upload to Grove
        const result = await groveService.uploadFile(file);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Upload failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: result.url,
            hash: result.hash,
        });
    } catch (error) {
        serverLogger.error('API Grove Upload Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
