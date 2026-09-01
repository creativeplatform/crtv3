import { NextResponse } from "next/server";
import {
  CREATIVE_TWIN_TEMPLATE_ID,
  CREATIVE_TWIN_TEMPLATE_URL,
  findCreativeTwinTemplate,
} from "@/lib/pinata/api";
import { serverLogger } from "@/lib/utils/logger";

/**
 * Returns Creative AI Digital Twin *template* metadata (org template ID, not
 * a deployed agent). Prefers GET /v0/templates/id/{id} via PINATA_JWT, with
 * public-marketplace slug as fallback. Cached server-side for 1 hour.
 */
export async function GET() {
  try {
    const template = await findCreativeTwinTemplate();
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Twin template not found. Ensure PINATA_JWT can read template ${CREATIVE_TWIN_TEMPLATE_ID} (slug creative-ai-digital-twin), or publish it to the marketplace.`,
          deployUrl: CREATIVE_TWIN_TEMPLATE_URL,
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      template,
      deployUrl: CREATIVE_TWIN_TEMPLATE_URL,
    });
  } catch (err) {
    serverLogger.error("twin/template fetch failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch template",
        deployUrl: CREATIVE_TWIN_TEMPLATE_URL,
      },
      { status: 502 }
    );
  }
}
