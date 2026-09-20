"use client";

import { useCallback, useEffect, useState } from "react";

import { getUser, type UserRole } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/ToastContext";
import Skeleton from "@/components/ui/Skeleton";
import ProductListingRow from "@/components/storefront/ProductListingRow";
import type { ProductWithListing } from "@/types/storefront";

export default function StorefrontManagerPage() {
  const { showToast } = useToast();
  const [role, setRole] = useState<UserRole | null>(null);
  const [products, setProducts] = useState<ProductWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiClient.get<ProductWithListing[]>(
      "/api/storefront/listings"
    );
    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }
    setProducts(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const user = getUser();
    setRole(user?.role ?? null);
    fetchData();
  }, [fetchData]);

  async function handleCreate(
    productId: string,
    wholesalePrice: number,
    isVisible: boolean
  ) {
    setBusyId(productId);
    const previous = products;
    setProducts((rows) =>
      rows.map((row) =>
        row.productId === productId
          ? {
              ...row,
              listing: {
                id: "temp",
                wholesalePrice: wholesalePrice.toFixed(2),
                isVisible,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }
          : row
      )
    );

    const result = await apiClient.post<ProductWithListing["listing"]>(
      "/api/storefront/listings",
      { productId, wholesalePrice, isVisible }
    );

    setBusyId(null);

    if (!result.success) {
      setProducts(previous);
      showToast(result.message, "error");
      return;
    }

    showToast("Storefront listing saved", "success");
    await fetchData();
  }

  async function handleUpdate(
    listingId: string,
    data: { wholesalePrice?: number; isVisible?: boolean }
  ) {
    const product = products.find((p) => p.listing?.id === listingId);
    if (!product?.listing) return;

    setBusyId(product.productId);
    const previous = products;

    setProducts((rows) =>
      rows.map((row) => {
        if (row.listing?.id !== listingId || !row.listing) return row;
        return {
          ...row,
          listing: {
            ...row.listing,
            wholesalePrice:
              data.wholesalePrice !== undefined
                ? data.wholesalePrice.toFixed(2)
                : row.listing.wholesalePrice,
            isVisible:
              data.isVisible !== undefined
                ? data.isVisible
                : row.listing.isVisible,
          },
        };
      })
    );

    const result = await apiClient.patch<ProductWithListing["listing"]>(
      `/api/storefront/listings/${listingId}`,
      data
    );

    setBusyId(null);

    if (!result.success) {
      setProducts(previous);
      showToast(result.message, "error");
      return;
    }

    showToast("Storefront listing updated", "success");
    await fetchData();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Storefront</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose which products appear on the public wholesale storefront and
          set per-piece prices.{" "}
          <a
            href="/storefront"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Open public storefront
          </a>
          {" · "}
          <a
            href="/storefront-inquiries"
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            View inquiries
          </a>
        </p>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No active products yet. Create products first, then list them here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Wholesale price</th>
                <th className="px-4 py-3 font-semibold">Visible</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductListingRow
                  key={product.productId}
                  product={product}
                  role={role ?? "STAFF"}
                  busy={busyId === product.productId}
                  onCreate={handleCreate}
                  onUpdate={handleUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
