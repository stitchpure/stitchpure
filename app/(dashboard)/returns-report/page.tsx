'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Skeleton from '@/components/ui/Skeleton';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReturnReportItem {
  listingId: string | null;
  totalOrders: number;
  returnCount: number;
  returnRate: number;
  reasonBreakdown: Record<string, number>;
  conditionBreakdown: Record<string, number>;
}

interface Listing {
  id: string;
  title: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ReturnsReportPage() {
  const { showToast } = useToast();

  const [reportData, setReportData] = useState<ReturnReportItem[]>([]);
  const [listingMap, setListingMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);

    const [reportResult, listingsResult] = await Promise.all([
      apiClient.get<ReturnReportItem[]>('/api/returns/report'),
      apiClient.get<Listing[]>('/api/listings?limit=100'),
    ]);

    if (reportResult.success && 'data' in reportResult) {
      setReportData(reportResult.data);
    } else {
      setError(reportResult.message);
      setLoading(false);
      return;
    }

    if (listingsResult.success && 'data' in listingsResult) {
      const map: Record<string, string> = {};
      for (const listing of listingsResult.data) {
        map[listing.id] = listing.title;
      }
      setListingMap(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  // ── Computed totals ──────────────────────────────────────────────────────

  const totals = reportData.reduce(
    (acc, item) => ({
      totalOrders: acc.totalOrders + item.totalOrders,
      returnCount: acc.returnCount + item.returnCount,
    }),
    { totalOrders: 0, returnCount: 0 }
  );

  const overallReturnRate =
    totals.totalOrders > 0 ? totals.returnCount / totals.totalOrders : 0;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatRate(rate: number): string {
    return (rate * 100).toFixed(1) + '%';
  }

  function getListingName(listingId: string | null): string {
    if (!listingId) return 'Unknown';
    return listingMap[listingId] || listingId.slice(0, 8) + '…';
  }

  function formatBreakdown(breakdown: Record<string, number>): React.ReactNode {
    const entries = Object.entries(breakdown);
    if (entries.length === 0) return <span className="text-gray-400">—</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
          >
            {key.replace(/_/g, ' ')}: {value}
          </span>
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Returns Report</h1>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <Skeleton className="h-10 w-1/6 rounded" />
                  <Skeleton className="h-10 w-1/6 rounded" />
                  <Skeleton className="h-10 w-1/6 rounded" />
                  <Skeleton className="h-10 w-1/6 rounded" />
                  <Skeleton className="h-10 w-1/6 rounded" />
                  <Skeleton className="h-10 w-1/6 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={fetchReport}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && reportData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No return data available yet.</p>
            </div>
          )}

          {!loading && !error && reportData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Listing</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total Orders</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Returns</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Return Rate</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Reason Breakdown</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Condition Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => (
                    <tr
                      key={item.listingId ?? 'unknown'}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={item.listingId ?? undefined}>
                        {getListingName(item.listingId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.totalOrders}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.returnCount}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`font-medium ${
                            item.returnRate >= 0.3
                              ? 'text-red-600'
                              : item.returnRate >= 0.15
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatRate(item.returnRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatBreakdown(item.reasonBreakdown)}</td>
                      <td className="px-4 py-3 text-sm">{formatBreakdown(item.conditionBreakdown)}</td>
                    </tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{totals.totalOrders}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{totals.returnCount}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="font-medium text-gray-900">{formatRate(overallReturnRate)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
