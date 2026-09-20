"use client";

import { useState } from "react";

import VisibilityToggle from "./VisibilityToggle";
import WholesalePriceInput from "./WholesalePriceInput";
import type { ProductWithListing } from "@/types/storefront";
import type { UserRole } from "@/lib/auth";

interface ProductListingRowProps {
  product: ProductWithListing;
  role: UserRole;
  busy: boolean;
  onCreate: (
    productId: string,
    wholesalePrice: number,
    isVisible: boolean
  ) => Promise<void>;
  onUpdate: (
    listingId: string,
    data: { wholesalePrice?: number; isVisible?: boolean }
  ) => Promise<void>;
}

function validatePrice(raw: string): string | null {
  if (!raw.trim()) return "Enter a wholesale price between ₹0.01 and ₹9,999,999.99";
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.01 || value > 9999999.99) {
    return "Price must be between ₹0.01 and ₹9,999,999.99";
  }
  return null;
}

export default function ProductListingRow({
  product,
  role,
  busy,
  onCreate,
  onUpdate,
}: ProductListingRowProps) {
  const canManage = role === "OWNER" || role === "MANAGER";
  const [price, setPrice] = useState(
    product.listing?.wholesalePrice ?? ""
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isVisible = product.listing?.isVisible ?? false;
  const disabled = !canManage || busy || saving;

  async function persistVisibility(nextVisible: boolean) {
    const error = validatePrice(price);
    if (nextVisible && error) {
      setPriceError(error);
      return;
    }
    setPriceError(null);
    setSaving(true);
    try {
      const numericPrice = Number(price);
      if (!product.listing) {
        await onCreate(product.productId, numericPrice, nextVisible);
      } else {
        await onUpdate(product.listing.id, {
          isVisible: nextVisible,
          wholesalePrice: numericPrice,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function persistPrice() {
    const error = validatePrice(price);
    if (error) {
      setPriceError(error);
      return;
    }
    setPriceError(null);

    // Don't auto-create listing on blur unless one already exists or visible
    if (!product.listing) return;

    const numericPrice = Number(price);
    if (product.listing.wholesalePrice === numericPrice.toFixed(2)) return;

    setSaving(true);
    try {
      await onUpdate(product.listing.id, { wholesalePrice: numericPrice });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.productImages[0] || "/placeholder-product.svg"}
            alt=""
            className="h-10 w-10 rounded-md object-cover bg-gray-100"
          />
          <span className="font-medium text-gray-900">{product.productName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <WholesalePriceInput
            value={price}
            disabled={disabled}
            error={priceError}
            onChange={(value) => {
              setPrice(value);
              if (priceError) setPriceError(validatePrice(value));
            }}
            onBlur={persistPrice}
          />
        ) : (
          <span className="text-sm text-gray-700">
            {product.listing
              ? `₹${Number(product.listing.wholesalePrice).toFixed(2)}`
              : "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <VisibilityToggle
            checked={isVisible}
            disabled={disabled}
            onChange={persistVisibility}
          />
        ) : (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              isVisible
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isVisible ? "Visible" : "Hidden"}
          </span>
        )}
      </td>
    </tr>
  );
}
