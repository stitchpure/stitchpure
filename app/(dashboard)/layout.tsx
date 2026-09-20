'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { isTokenValid, removeToken, getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { ToastProvider } from '@/components/ui/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  logo: string | null;
  subscriptionPlan: string;
  isActive: boolean;
}

/**
 * Protected dashboard shell.
 *
 * - Auth guard on mount: invalid/missing token → redirect to /login
 * - Fetches company name after auth check
 * - Renders Sidebar + Header around {children}
 * - Provides ToastContext to the entire dashboard subtree
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function init() {
      // Auth guard
      if (!isTokenValid()) {
        removeToken();
        router.push('/login');
        return;
      }

      const localUser = getUser();
      if (!localUser) {
        removeToken();
        router.push('/login');
        return;
      }

      setRole(localUser.role);

      // Fetch company data (always accessible regardless of role)
      const companyResult = await apiClient.get<Company>(
        `/api/companies/${localUser.companyId}`
      );

      if (companyResult.success && 'data' in companyResult) {
        setCompanyName(companyResult.data.name ?? '');
      }

      // Attempt to get current user name from /api/me
      // The endpoint returns { success: true, user: { userId, companyId, role } }
      // from the JWT decode — no display name available here.
      // We use the userId as a best-effort display fallback.
      setUserName(localUser.userId ? 'User' : '');

      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    removeToken();
    router.push('/login');
  }

  // Show minimal loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div
          className="flex flex-col items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar
          role={role}
          companyName={companyName}
          currentPath={pathname}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header
            companyName={companyName}
            userName={userName}
            onLogout={handleLogout}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
