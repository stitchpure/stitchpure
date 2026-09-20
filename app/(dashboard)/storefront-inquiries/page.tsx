"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { apiClient } from "@/lib/api-client";
import Skeleton from "@/components/ui/Skeleton";
import type { StorefrontInquiry } from "@/types/storefront";

export default function StorefrontInquiriesPage() {
  const [inquiries, setInquiries] = useState<StorefrontInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiClient.get<StorefrontInquiry[]>(
      "/api/storefront/inquiries"
    );
    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }
    setInquiries(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Wholesale inquiries from the public storefront.
          </p>
        </div>
        <Link
          href="/storefront-manager"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Manage storefront →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
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
      ) : inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No inquiries yet. When buyers submit the storefront form, they will
          appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <article
              key={inquiry.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{inquiry.name}</h2>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {inquiry.phone}
                    {inquiry.email ? ` · ${inquiry.email}` : ""}
                  </p>
                </div>
                <time className="text-xs text-gray-500">
                  {new Date(inquiry.createdAt).toLocaleString()}
                </time>
              </div>
              {inquiry.productName ? (
                <p className="mt-2 text-xs font-medium tracking-wide text-indigo-700 uppercase">
                  Product: {inquiry.productName}
                </p>
              ) : null}
              <p className="mt-2 text-sm whitespace-pre-wrap text-gray-700">
                {inquiry.message}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
