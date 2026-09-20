import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/middleware/auth";
import crypto from "crypto";

/**
 * POST /api/upload/delete
 * Body: { publicId: string }
 *
 * Deletes an image from Cloudinary by its public_id.
 * Protected — requires a valid JWT.
 */
export async function POST(request: NextRequest) {
  try {
    authMiddleware(request);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, message: "Cloudinary is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const publicId = body?.publicId as string | undefined;

    if (!publicId) {
      return NextResponse.json(
        { success: false, message: "publicId is required" },
        { status: 400 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Signature: SHA1 of "public_id=...&timestamp=...{apiSecret}"
    const signaturePayload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash("sha1")
      .update(signaturePayload)
      .digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: "POST", body: formData }
    );

    const data = await response.json();

    if (!response.ok || data.result === "not found") {
      // Not found is okay — image may already be gone
      return NextResponse.json({ success: true, result: data.result ?? "ok" });
    }

    return NextResponse.json({ success: true, result: data.result });
  } catch (error: any) {
    console.error("[upload/delete] error:", error);
    return NextResponse.json(
      { success: false, message: error.message ?? "Delete failed" },
      { status: error.statusCode ?? 500 }
    );
  }
}
