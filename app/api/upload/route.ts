import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/middleware/auth";
import crypto from "crypto";

/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data request with a single "file" field.
 * Uploads to Cloudinary using the signed upload API (no SDK needed).
 * Returns { url, publicId } on success.
 *
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size — max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File size must be under 2MB" },
        { status: 400 }
      );
    }

    // Build signed upload params
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "stock-management/categories";

    // Signature: SHA1 of "folder=...&timestamp=...{apiSecret}"
    const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash("sha1")
      .update(signaturePayload)
      .digest("hex");

    // Upload to Cloudinary via REST API
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("api_key", apiKey);
    uploadFormData.append("timestamp", String(timestamp));
    uploadFormData.append("signature", signature);
    uploadFormData.append("folder", folder);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadFormData }
    );

    const cloudinaryData = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: cloudinaryData?.error?.message ?? "Upload failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: cloudinaryData.secure_url as string,
      publicId: cloudinaryData.public_id as string,
    });
  } catch (error: any) {
    console.error("[upload] error:", error);
    return NextResponse.json(
      { success: false, message: error.message ?? "Upload failed" },
      { status: error.statusCode ?? 500 }
    );
  }
}
