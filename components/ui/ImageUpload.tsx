'use client';

import { useRef, useState } from 'react';
import { getToken } from '@/lib/auth';

interface ImageUploadProps {
  /** Current image URL (if already uploaded) */
  value: string;
  /** Called with the new Cloudinary URL after a successful upload, or '' on remove */
  onChange: (url: string) => void;
  /** Slot label, e.g. "Image 1" */
  label?: string;
  /** Whether the input should be disabled */
  disabled?: boolean;
}

/**
 * Single image upload slot backed by Cloudinary.
 *
 * - Uploads via POST /api/upload → gets back { url, publicId }
 * - Tracks the publicId in local state
 * - On Remove or Replace: calls POST /api/upload/delete with the old publicId
 *   so Cloudinary storage stays clean
 */
export default function ImageUpload({
  value,
  onChange,
  label,
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // Track the Cloudinary public_id so we can delete it later
  const [publicId, setPublicId] = useState('');

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * Extract the Cloudinary public_id from a Cloudinary URL.
   * URL pattern: https://res.cloudinary.com/{cloud}/image/upload/v{ver}/{public_id}.{ext}
   * Returns '' for non-Cloudinary URLs.
   */
  function extractPublicId(url: string): string {
    if (!url) return '';
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function authHeader(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Fire-and-forget Cloudinary delete for the given publicId */
  async function deleteFromCloudinary(pid: string) {
    if (!pid) return;
    try {
      await fetch('/api/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ publicId: pid }),
      });
    } catch {
      // Best-effort — don't block the user
    }
  }

  // ── handlers ─────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    // If there's already an image, delete it from Cloudinary before uploading.
    // Prefer tracked publicId (from this session), fall back to extracting from URL (existing DB images).
    const oldPublicId = publicId || extractPublicId(value);
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
      setPublicId('');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeader(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message ?? 'Upload failed');
      } else {
        setPublicId(data.publicId ?? '');
        onChange(data.url);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleClear() {
    // Delete from Cloudinary — prefer tracked publicId, fall back to extracting from URL
    const oldPublicId = publicId || extractPublicId(value);
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
      setPublicId('');
    }
    onChange('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail or placeholder */}
      <div className="w-16 h-16 shrink-0 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50">
        {value ? (
          <img
            src={value}
            alt={label ?? 'image'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md
              hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Uploading…
              </span>
            ) : value ? 'Replace' : 'Upload Image'}
          </button>

          {value && !uploading && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md
                hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}

        {value && !uploading && (
          <p className="mt-1 text-xs text-gray-400 truncate max-w-[200px]" title={value}>
            {value.split('/').pop()}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        aria-label={label ?? 'Upload image'}
      />
    </div>
  );
}
