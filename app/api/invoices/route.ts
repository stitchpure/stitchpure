import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { invoiceListFiltersSchema } from "@/validators/invoice.validator";
import { listInvoices, searchInvoices } from "@/services/invoice.service";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get("search")?.trim() || undefined;

    // If search param is present, use searchInvoices
    if (search) {
      const { data, total } = await searchInvoices(user.companyId, search, params);
      const pagination = buildPaginationMeta(total, params);
      return NextResponse.json({ success: true, data, pagination });
    }

    // Otherwise parse filters and use listInvoices
    const rawFilters = {
      financialYear: searchParams.get("financialYear") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      salesChannelId: searchParams.get("salesChannelId") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const filters = invoiceListFiltersSchema.parse(rawFilters);

    const { data, total } = await listInvoices(user.companyId, params, filters);
    const pagination = buildPaginationMeta(total, params);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch invoices");
  }
}
