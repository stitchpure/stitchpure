import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { ServiceError } from "@/lib/service-error";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateInvoice } from "@/services/invoice.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;

    // Fetch invoice record and verify company ownership
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.companyId, user.companyId)))
      .limit(1);

    if (!invoice) {
      throw new ServiceError("Invoice not found", 404);
    }

    // Regenerate PDF from current sale data using the stored invoice number
    const { pdfBuffer, filename, warnings } = await generateInvoice(
      user.companyId,
      { saleId: invoice.saleId }
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Invoice-Warnings": JSON.stringify(warnings),
      },
    });
  } catch (error) {
    return handleApiError(error, "Unable to download invoice");
  }
}
