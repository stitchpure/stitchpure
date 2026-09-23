import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { Roles } from "@/types/role";

import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/services/category.service";

import { updateCategorySchema } from "@/validators/category.validator";

import { formatZodError } from "@/lib/error-handler";

// GET SINGLE CATEGORY

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const category = await getCategoryById(user.companyId, id);

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      data: category,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 401,
      }
    );
  }
}

// UPDATE CATEGORY

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();

    const data = updateCategorySchema.parse(body);
    const { id } = await params;

    const category = await updateCategory(
      user.companyId,

      id,

      data
    );

    if (!category) {
      return NextResponse.json(
        {
          success: false,

          message: "Category not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message: "Category updated successfully",

      data: category,
    });
  } catch (error: any) {
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

    return NextResponse.json(
      {
        success: false,

        message: error.message,
      },
      {
        status: error.statusCode ?? 400,
      }
    );
  }
}

// DELETE CATEGORY

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);
    const { id } = await params;
    const category = await deleteCategory(
      user.companyId,

      id
    );

    if (!category) {
      return NextResponse.json(
        {
          success: false,

          message: "Category not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message: "Category deleted successfully",

      data: category,
    });
  } catch (error: any) {
    const status = error.statusCode
      ? error.statusCode
      : error.message?.startsWith("Cannot delete")
        ? 409
        : 400;
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status,
      }
    );
  }
}
