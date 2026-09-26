'use client';

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ImageUpload from '@/components/ui/ImageUpload';

interface Category {
  id: string;
  name: string;
}

interface SizeRow {
  size: string;
  sku: string;
  sellingPrice: string;
  mrp: string;
  weight: string;
  quantity: string;
}

// Common apparel sizes offered as quick-add chips.
const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function emptyRow(size: string): SizeRow {
  return { size, sku: '', sellingPrice: '', mrp: '', weight: '', quantity: '0' };
}

/**
 * Unified "Add Catalog" page (Meesho-style single-catalog upload).
 *
 * Fill product details once, pick the sizes, then fill each size's SKU, price,
 * MRP and opening quantity. One submit creates the product, its Size option +
 * values, one SKU per size, and opening stock — all in a single transaction
 * via POST /api/catalog.
 */
export default function AddCatalogPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);

  // Product-level fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>(['', '', '']);

  // Size rows
  const [rows, setRows] = useState<SizeRow[]>([]);

  const [copyPrice, setCopyPrice] = useState(true);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sizeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<Category[]>('/api/categories').then((res) => {
      if (res.success) setCategories(res.data);
    });
  }, []);

  // Close the size dropdown when clicking outside of it.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
        setSizeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectedSizes = useMemo(() => rows.map((r) => r.size), [rows]);

  function toggleSize(size: string) {
    setRows((prev) => {
      const exists = prev.find((r) => r.size === size);
      if (exists) return prev.filter((r) => r.size !== size);
      return [...prev, emptyRow(size)];
    });
  }

  function addCustomSize() {
    const label = window.prompt('Enter size label (e.g. 3XL, Free Size)')?.trim();
    if (!label) return;
    if (rows.some((r) => r.size.toLowerCase() === label.toLowerCase())) {
      showToast('That size is already added', 'error');
      return;
    }
    setRows((prev) => [...prev, emptyRow(label)]);
  }

  function updateRow(index: number, field: keyof SizeRow, value: string) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r));
      // When "copy price to all" is on, propagate price/mrp/weight from the
      // first row to every row.
      if (copyPrice && (field === 'sellingPrice' || field === 'mrp' || field === 'weight') && index === 0) {
        return next.map((r, i) => (i === 0 ? r : { ...r, [field]: value }));
      }
      return next;
    });
  }

  function setImageAt(i: number, url: string) {
    setImages((prev) => prev.map((v, idx) => (idx === i ? url : v)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (rows.length === 0) {
      setError('Add at least one size.');
      return;
    }

    const payload = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      hsnCode: hsnCode.trim() || undefined,
      description: description.trim() || undefined,
      images: images.filter(Boolean),
      optionName: 'Size',
      sizes: rows.map((r) => ({
        size: r.size,
        sku: r.sku.trim(),
        sellingPrice: Number(r.sellingPrice || 0),
        mrp: r.mrp ? Number(r.mrp) : null,
        weight: r.weight ? Number(r.weight) : null,
        quantity: Number(r.quantity || 0),
      })),
    };

    setSubmitting(true);
    const res = await apiClient.post('/api/catalog', payload);
    setSubmitting(false);

    if (res.success) {
      showToast('Catalog created successfully', 'success');
      router.push('/products');
    } else {
      setError(res.message || 'Failed to create catalog.');
    }
  }

  const inputCls =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900">Add Single Catalog</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product details */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Product details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                Product name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Oversized Street Tee"
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hsn" className="mb-1 block text-sm font-medium text-gray-700">
                HSN code
              </label>
              <input
                id="hsn"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                className={inputCls}
                placeholder="62059010"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="desc" className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputCls} resize-y`}
                placeholder="Premium-look pullover with a comfortable fit…"
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-gray-700">Images (up to 3)</p>
            <div className="space-y-3">
              {images.map((url, i) => (
                <ImageUpload
                  key={i}
                  value={url}
                  onChange={(u) => setImageAt(i, u)}
                  label={`Image ${i + 1}`}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Size selection */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Sizes & inventory
          </h2>

          {/* Size selector — pick sizes from the dropdown; rows appear below. */}
          <div className="mb-5 max-w-sm">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Size <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={sizeMenuRef}>
              <button
                type="button"
                onClick={() => setSizeMenuOpen((v) => !v)}
                className={`${inputCls} flex items-center justify-between text-left`}
                aria-haspopup="listbox"
                aria-expanded={sizeMenuOpen}
              >
                <span className={selectedSizes.length ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedSizes.length
                    ? selectedSizes.join(', ')
                    : 'Select sizes'}
                </span>
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${sizeMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {sizeMenuOpen && (
                <div
                  className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  {PRESET_SIZES.map((s) => {
                    const active = selectedSizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSize(s)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        role="option"
                        aria-selected={active}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          readOnly
                          className="rounded border-gray-300"
                        />
                        {s}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addCustomSize}
                    className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-gray-50"
                  >
                    + Add custom size
                  </button>
                </div>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={copyPrice}
                onChange={(e) => setCopyPrice(e.target.checked)}
                className="rounded border-gray-300"
              />
              Copy price / MRP / weight from the first row to all sizes
            </label>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">Pick one or more sizes to add inventory rows.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-2">Size</th>
                    <th className="px-2">SKU <span className="text-red-500">*</span></th>
                    <th className="px-2">Price <span className="text-red-500">*</span></th>
                    <th className="px-2">MRP</th>
                    <th className="px-2">Weight (g)</th>
                    <th className="px-2">Opening qty</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.size} className="align-top">
                      <td className="px-2 py-1">
                        <span className="inline-flex h-9 min-w-[3rem] items-center justify-center rounded-md bg-gray-100 px-3 font-bold text-gray-800">
                          {row.size}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          required
                          value={row.sku}
                          onChange={(e) => updateRow(i, 'sku', e.target.value)}
                          className={inputCls}
                          placeholder="TEE-RED-M"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.sellingPrice}
                          onChange={(e) => updateRow(i, 'sellingPrice', e.target.value)}
                          className={inputCls}
                          placeholder="799"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.mrp}
                          onChange={(e) => updateRow(i, 'mrp', e.target.value)}
                          className={inputCls}
                          placeholder="1299"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.weight}
                          onChange={(e) => updateRow(i, 'weight', e.target.value)}
                          className={inputCls}
                          placeholder="250"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                          className={inputCls}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => toggleSize(row.size)}
                          className="mt-1 text-gray-400 hover:text-red-600"
                          aria-label={`Remove ${row.size}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/products')}
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {submitting ? 'Creating…' : 'Submit Catalog'}
          </button>
        </div>
      </form>
    </div>
  );
}
