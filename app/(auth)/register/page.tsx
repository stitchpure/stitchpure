'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, setToken, setRefreshToken } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';

interface RegisterResponseData {
  token: string;
  refreshToken?: string;
  companyId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * One-time setup / registration page.
 *
 * This creates the FIRST admin (OWNER) user of a fresh deployment. The backend
 * (`POST /api/auth/register`) only allows this while no user exists yet; once
 * the first account is created it returns 403 and this form stops working.
 *
 * - If already authenticated, redirect to dashboard.
 * - On submit: POST /api/auth/register, store JWT, redirect to /dashboard.
 * - After success it also shows the created company id so it can be set as
 *   SINGLE_COMPANY_ID in the environment.
 */
export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isTokenValid()) {
      router.replace('/');
    }
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await apiClient.post<RegisterResponseData>(
      '/api/auth/register',
      { name, email, password, companyName: companyName || undefined }
    );

    if (result.success) {
      setToken(result.data.token);
      if (result.data.refreshToken) {
        setRefreshToken(result.data.refreshToken);
      }
      // Surface the company id briefly so it can be copied into
      // SINGLE_COMPANY_ID, then move on to the dashboard.
      setCompanyId(result.data.companyId);
      router.push('/dashboard');
    } else {
      setError(result.message || 'Registration failed. Please try again.');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create admin account</h1>
            <p className="mt-1 text-sm text-gray-500">
              One-time setup for this store
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
            {/* Name */}
            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="Your name"
                aria-required="true"
              />
            </div>

            {/* Company name (optional) */}
            <div className="mb-4">
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Company name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="companyName"
                type="text"
                autoComplete="organization"
                disabled={loading}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="StitchPure"
              />
            </div>

            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="you@example.com"
                aria-required="true"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="••••••••"
                aria-required="true"
              />
              <p className="mt-1 text-xs text-gray-400">
                Min 8 chars with uppercase, lowercase, number and special character.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Company id notice after success */}
            {companyId && (
              <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                Account created. Set this as SINGLE_COMPANY_ID in your
                environment:
                <code className="mt-1 block break-all font-mono text-xs text-green-900">
                  {companyId}
                </code>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !name || !email || !password}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-busy={loading}
            >
              {loading && (
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="text-indigo-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
