import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { bulkDownloadSchema } from "@/validators/invoice.validator";
import { bulkDownloadInvoices } from "@/services/invoice-bulk.service";

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const body = await request.json();
    const input = bulkDownloadSchema.parse(body);

    const result = await bulkDownloadInvoices(user.companyId, {
      saleIds: input.saleIds,
    });

    return new NextResponse(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Invoice-Generated": String(result.generated),
        "X-Invoice-Skipped": String(result.skipped.length),
        "X-Invoice-Failed": String(result.failed.length),
      },
    });
  } catch (error) {
    return handleApiError(error, "Unable to generate bulk invoice download");
  }
}
