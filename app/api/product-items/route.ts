import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { Roles } from "@/types/role";

import {
  createProductItem,
  getProductItems,
  ProductItemServiceError,
} from "@/services/product-item.service";

import { createProductItemSchema } from "@/validators/product-item.validator";
import { formatZodError } from "@/lib/format-zod-error";

const PRODUCT_ITEM_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;

type ProductItemStatus = (typeof PRODUCT_ITEM_STATUSES)[number];

export async function POST(request: NextRequest) {
  try {
    const authUser = authMiddleware(request);
    requireRole(authUser, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();

    const validatedData = createProductItemSchema.parse(body);

    const productItem = await createProductItem({
      companyId: authUser.companyId,
      data: validatedData,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Product item created successfully",
        data: productItem,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return handleProductItemError(error, "Unable to create product item");
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = authMiddleware(request);

    const { searchParams } = new URL(request.url);

    const productId = searchParams.get("productId")?.trim() || undefined;

    const search = searchParams.get("search")?.trim() || undefined;

    const statusParam = searchParams.get("status")?.trim() || undefined;

    let status: ProductItemStatus | undefined;

    if (statusParam) {
      if (!PRODUCT_ITEM_STATUSES.includes(statusParam as ProductItemStatus)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid product item status",
          },
          {
            status: 400,
          }
        );
      }

      status = statusParam as ProductItemStatus;
    }

    const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10) || 20;

    const { data: productItemList, total } = await getProductItems({
      companyId: authUser.companyId,
      productId,
      search,
      status,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json(
      {
        success: true,
        message: "Product items fetched successfully",
        data: productItemList,
        pagination: { page, limit, total, totalPages },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    return handleProductItemError(error, "Unable to fetch product items");
  }
}

function handleProductItemError(error: unknown, defaultMessage: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        errors: formatZodError(error),
      },
      {
        status: 400,
      }
    );
  }

  if (error instanceof ProductItemServiceError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: error.statusCode,
      }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid JSON body",
      },
      {
        status: 400,
      }
    );
  }

  // Errors carrying an explicit statusCode (e.g. requireRole → 403)
  const errWithStatus = error as { statusCode?: number; message?: string } | null;
  if (typeof errWithStatus?.statusCode === "number") {
    return NextResponse.json(
      { success: false, message: errWithStatus.message ?? defaultMessage },
      { status: errWithStatus.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : defaultMessage;

  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("token") ||
    normalizedMessage.includes("authorization")
  ) {
    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 401,
      }
    );
  }

  console.error(defaultMessage, error);

  return NextResponse.json(
    {
      success: false,
      message: defaultMessage,
    },
    {
      status: 500,
    }
  );
}
