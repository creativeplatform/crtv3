import { NextResponse } from "next/server";
import { findCreativeTwinTemplate } from "@/lib/pinata/api";
import { serverLogger } from "@/lib/utils/logger";

/**
 * Returns the live Creative AI Digital Twin template metadata pulled from the
 * Pinata public-templates catalog. Cached server-side for 1 hour.
 */
export async function GET() {
  try {
    const template = await findCreativeTwinTemplate();
    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found in Pinata catalog" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, template });
  } catch (err) {
    serverLogger.error("twin/template fetch failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch template",
      },
      { status: 502 }
    );
  }
}
