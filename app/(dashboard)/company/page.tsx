'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Skeleton from '@/components/ui/Skeleton';
import { isValidGstin, GSTIN_ERROR_MESSAGE } from '@/lib/gstin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  logo: string | null;
  gstin: string | null;
  subscriptionPlan: string;
  isActive: boolean;
}

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  logo: string;
  gstin: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompanyPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Auth
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Data
  const [company, setCompany] = useState<Company | null>(null);

  // Form state
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    email: '',
    phone: '',
    logo: '',
    gstin: '',
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gstinError, setGstinError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch company
  // ---------------------------------------------------------------------------

  async function fetchCompany(cId: string) {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<Company>(`/api/companies/${cId}`);

    if (result.success && 'data' in result) {
      const data = result.data;
      setCompany(data);
      setFormData({
        name: data.name,
        email: data.email,
        phone: data.phone,
        logo: data.logo ?? '',
        gstin: data.gstin ?? '',
      });
    } else {
      setError(result.message);
    }

    setLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== 'OWNER') {
      router.replace('/');
      return;
    }
    setCompanyId(user.companyId);
    fetchCompany(user.companyId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRetry() {
    if (companyId) {
      fetchCompany(companyId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    // Client-side GSTIN validation
    const gstinValue = formData.gstin.trim();
    if (gstinValue && !isValidGstin(gstinValue)) {
      setGstinError(GSTIN_ERROR_MESSAGE);
      return;
    }
    setGstinError(null);

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      gstin: gstinValue || null,
    };

    if (formData.logo.trim()) {
      payload.logo = formData.logo.trim();
    } else {
      payload.logo = null;
    }

    const result = await apiClient.patch<Company>(
      `/api/companies/${companyId}`,
      payload
    );

    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('Company profile updated successfully', 'success');
      fetchCompany(companyId);
    } else {
      showToast(result.message, 'error');
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Card container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Company Profile</h1>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading state */}
          {loading && (
            <div className="space-y-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-4 items-center">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-10 col-span-2 w-full rounded-md" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Form */}
          {!loading && !error && company && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Slug — read-only */}
              <div className="grid grid-cols-3 gap-4 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">
                  Slug
                </label>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 py-2">{company.slug}</p>
                  <p className="text-xs text-gray-400">Read-only</p>
                </div>
              </div>

              {/* Subscription Plan — read-only */}
              <div className="grid grid-cols-3 gap-4 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">
                  Subscription Plan
                </label>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 py-2">{company.subscriptionPlan}</p>
                  <p className="text-xs text-gray-400">Read-only</p>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Name */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label
                  htmlFor="company-name"
                  className="text-sm font-medium text-gray-700"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    id="company-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label
                  htmlFor="company-email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    id="company-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label
                  htmlFor="company-phone"
                  className="text-sm font-medium text-gray-700"
                >
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    id="company-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* GSTIN */}
              <div className="grid grid-cols-3 gap-4 items-start">
                <label
                  htmlFor="company-gstin"
                  className="text-sm font-medium text-gray-700 pt-2"
                >
                  GSTIN
                </label>
                <div className="col-span-2 space-y-1">
                  <input
                    id="company-gstin"
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => {
                      setFormData({ ...formData, gstin: e.target.value.toUpperCase() });
                      if (gstinError) setGstinError(null);
                    }}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      gstinError ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {gstinError && (
                    <p className="text-xs text-red-600">{gstinError}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    Optional — leave empty if not GST-registered
                  </p>
                </div>
              </div>

              {/* Logo URL */}
              <div className="grid grid-cols-3 gap-4 items-start">
                <label
                  htmlFor="company-logo"
                  className="text-sm font-medium text-gray-700 pt-2"
                >
                  Logo URL
                </label>
                <div className="col-span-2 space-y-2">
                  <input
                    id="company-logo"
                    type="url"
                    value={formData.logo}
                    onChange={(e) =>
                      setFormData({ ...formData, logo: e.target.value })
                    }
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {formData.logo && (
                    <img
                      src={formData.logo}
                      alt="Company logo preview"
                      className="h-12 w-12 object-contain rounded border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Save button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
