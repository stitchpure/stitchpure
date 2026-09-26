import { NextRequest } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { Roles } from "@/types/role";
import { createStockAdjustmentSchema } from "@/validators/stock-adjustment.validator";
import { adjustStockToQuantity } from "@/services/stock-ledger.service";
import { handleApiError, jsonOk } from "@/lib/api-route";

/**
 * POST /api/stock-adjustments
 *
 * Manually set an existing SKU's stock to a target quantity. Records the
 * difference as an ADJUSTMENT ledger entry. OWNER/MANAGER only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createStockAdjustmentSchema.parse(body);

    const result = await adjustStockToQuantity(
      user.companyId,
      data.productItemId,
      data.quantity,
      data.notes
    );

    return jsonOk(result, { message: "Stock updated" });
  } catch (error) {
    return handleApiError(error, "Unable to adjust stock");
  }
}
