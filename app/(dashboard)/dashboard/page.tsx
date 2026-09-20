'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCard {
  title: string;
  endpoint: string;
  value: number | null;
  loading: boolean;
  error: string | null;
  href: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Stat definitions
// ---------------------------------------------------------------------------

const INITIAL_STATS: StatCard[] = [
  {
    title: 'Products',
    endpoint: '/api/products',
    value: null, loading: true, error: null,
    href: '/products',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    title: 'SKUs',
    endpoint: '/api/product-items',
    value: null, loading: true, error: null,
    href: '/skus',
    color: 'bg-purple-50 text-purple-700',
  },
  {
    title: 'Purchases',
    endpoint: '/api/purchases',
    value: null, loading: true, error: null,
    href: '/purchases',
    color: 'bg-green-50 text-green-700',
  },
  {
    title: 'Sales',
    endpoint: '/api/sales',
    value: null, loading: true, error: null,
    href: '/sales',
    color: 'bg-orange-50 text-orange-700',
  },
  {
    title: 'Production Batches',
    endpoint: '/api/production-batches',
    value: null, loading: true, error: null,
    href: '/production-batches',
    color: 'bg-indigo-50 text-indigo-700',
  },
  {
    title: 'Expenses',
    endpoint: '/api/expenses',
    value: null, loading: true, error: null,
    href: '/expenses',
    color: 'bg-red-50 text-red-700',
  },
];

const QUICK_LINKS = [
  { label: 'New Purchase', href: '/purchases', icon: '📦' },
  { label: 'New Sale', href: '/sales', icon: '🛒' },
  { label: 'Create Batch', href: '/production-batches', icon: '🏭' },
  { label: 'Add Expense', href: '/expenses', icon: '💰' },
  { label: 'Cost Sheets', href: '/cost-sheets', icon: '📊' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>(INITIAL_STATS);

  useEffect(() => {
    INITIAL_STATS.forEach((stat, i) => {
      apiClient
        .get<unknown[]>(`${stat.endpoint}?page=1&limit=1`)
        .then((result) => {
          setStats((prev) =>
            prev.map((s, j) => {
              if (j !== i) return s;
              if (result.success && result.pagination != null) {
                return { ...s, loading: false, value: result.pagination.total, error: null };
              }
              return { ...s, loading: false, value: null, error: !result.success ? result.message : 'Failed' };
            })
          );
        })
        .catch(() => {
          setStats((prev) =>
            prev.map((s, j) =>
              j !== i ? s : { ...s, loading: false, value: null, error: 'Failed' }
            )
          );
        });
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your business at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${stat.color}`}>
              {stat.title}
            </span>
            <div className="mt-3">
              {stat.loading ? (
                <Skeleton className="h-8 w-16 rounded" />
              ) : stat.error ? (
                <span className="text-2xl font-bold text-gray-300">—</span>
              ) : (
                <span className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {stat.value?.toLocaleString() ?? '0'}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-center group"
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Getting Started</h3>
          <ul className="space-y-3">
            {[
              { text: 'Add your products and SKUs', href: '/products' },
              { text: 'Record purchases from suppliers', href: '/purchases' },
              { text: 'Track sales to customers', href: '/sales' },
              { text: 'Create production batches', href: '/production-batches' },
              { text: 'Log expenses for cost tracking', href: '/expenses' },
              { text: 'Generate cost sheets', href: '/cost-sheets' },
            ].map((item) => (
              <li key={item.text}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Stock Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Navigation</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Categories', href: '/categories', desc: 'Organize products' },
              { label: 'Stock Ledger', href: '/stock-ledger', desc: 'View stock movements' },
              { label: 'Production', href: '/production-batches', desc: 'Manage batches' },
              { label: 'Cost Sheets', href: '/cost-sheets', desc: 'Unit cost breakdown' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
              >
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
