import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { generateInvoiceSchema } from "@/validators/invoice.validator";
import { generateInvoice } from "@/services/invoice.service";

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const body = await request.json();
    const input = generateInvoiceSchema.parse(body);
    const { pdfBuffer, filename, warnings } = await generateInvoice(user.companyId, input);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Invoice-Warnings": JSON.stringify(warnings),
      },
    });
  } catch (error) {
    return handleApiError(error, "Unable to generate invoice");
  }
}
