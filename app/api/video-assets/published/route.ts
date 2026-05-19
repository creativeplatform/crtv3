import { NextRequest, NextResponse } from "next/server";
import { getPublishedVideoAssets } from "@/services/video-assets";
import { serverLogger } from "@/lib/utils/logger";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/video-assets/published
 * 
 * Fetches published video assets from Supabase without caching so view-count
 * ordering reflects the latest synced metrics.
 * 
 * Query parameters:
 * - limit: number (default: 12)
 * - offset: number (default: 0)
 * - orderBy: 'created_at' | 'views_count' | 'likes_count' | 'updated_at' (default: 'created_at')
 * - order: 'asc' | 'desc' (default: 'desc')
 * - creatorId: string (optional)
 * - category: string (optional)
 * - search: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = parseInt(searchParams.get("offset") || "0");
    const orderBy = (searchParams.get("orderBy") || "created_at") as 'created_at' | 'views_count' | 'likes_count' | 'updated_at';
    const order = (searchParams.get("order") || "desc") as 'asc' | 'desc';
    const creatorId = searchParams.get("creatorId") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Limit must be between 1 and 100" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Fetch published videos from Supabase
    const result = await getPublishedVideoAssets({
      limit,
      offset,
      orderBy,
      order,
      creatorId,
      category,
      search,
    });

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    serverLogger.error("Error fetching published videos:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for database connection errors
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            error: 'Database connection error',
            details: 'Unable to connect to the database. Please try again later.'
          },
          { status: 503, headers: noStoreHeaders }
        );
      }
      
      // Check for validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return NextResponse.json(
          { 
            error: 'Validation error',
            details: error.message
          },
          { status: 400, headers: noStoreHeaders }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch published videos",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

