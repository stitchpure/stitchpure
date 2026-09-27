'use client';

import { useEffect, useState, useCallback, use, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ImageUpload from '@/components/ui/ImageUpload';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  hsnCode: string | null;
  images: string[];
  isActive: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  type: 'TEXT' | 'COLOR' | 'NUMBER';
  /**
   * False when the option was reconstructed from SKUs because the active
   * options endpoint didn't return it (i.e. it was soft-deleted). Such an
   * option must be reactivated before new SKUs can be attached to it.
   */
  isActive?: boolean;
}

interface Sku {
  id: string;
  sku: string;
  sellingPrice: string;
  mrp: string | null;
  weight: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  stockLevel: number;
  optionValues: Array<{
    optionId: string;
    optionValueId: string;
    value: string;
    optionName?: string;
  }>;
  // local editable copies
  _price: string;
  _mrp: string;
  _qty: string;
  _saving?: boolean;
}

/**
 * Unified product detail + edit page.
 *
 * One place to edit the product AND manage all its size variants (SKUs):
 * price, MRP, opening/current stock, status; add a new size; discontinue.
 * Replaces the old product-edit modal + separate SKUs/options pages for
 * day-to-day editing.
 */
export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: productId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [canManage] = useState(() => {
    const user = getUser();
    return user?.role === 'OWNER' || user?.role === 'MANAGER';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [sizeOption, setSizeOption] = useState<ProductOption | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);

  // Product form
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>(['', '', '']);
  const [savingProduct, setSavingProduct] = useState(false);

  // Add-size row
  const [newSize, setNewSize] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('0');
  const [addingSize, setAddingSize] = useState(false);

  // Create-Size-option (recovery when the Size option was deleted)
  const [creatingSizeOption, setCreatingSizeOption] = useState(false);

  // Delete-size confirmation
  const [skuToDelete, setSkuToDelete] = useState<Sku | null>(null);
  const [deletingSku, setDeletingSku] = useState(false);

  const loadSkus = useCallback(async (): Promise<Sku[]> => {
    const res = await apiClient.get<Sku[]>(
      `/api/product-items?productId=${productId}&limit=200`
    );
    if (!res.success) return [];
    const loaded = res.data.map((s) => ({
      ...s,
      _price: s.sellingPrice,
      _mrp: s.mrp ?? '',
      _qty: String(s.stockLevel),
    }));
    setSkus(loaded);
    return loaded;
  }, [productId]);

  /**
   * Derive the effective "Size" option a SKU is grouped under. The active
   * options endpoint hides soft-deleted options, so if the Size option was
   * deleted while SKUs still reference it, fall back to the optionId carried
   * on the existing SKUs. This keeps "Add size" working against the real
   * option instead of showing a misleading "no Size option" message.
   */
  function deriveSizeOption(
    activeOptions: ProductOption[],
    loadedSkus: Sku[]
  ): ProductOption | null {
    const fromActive =
      activeOptions.find((o) => o.name.toLowerCase() === 'size') ??
      activeOptions[0] ??
      null;
    if (fromActive) return { ...fromActive, isActive: true };

    // No active option — reconstruct from the SKUs' referenced option, using
    // the real option name (returned by the API) so reactivation targets the
    // same option the SKUs are already linked to.
    for (const sku of loadedSkus) {
      const ov = sku.optionValues[0];
      if (ov?.optionId) {
        return {
          id: ov.optionId,
          name: ov.optionName ?? 'Size',
          type: 'TEXT',
          isActive: false,
        };
      }
    }
    return null;
  }

  /**
   * Ensure the effective Size option is active before attaching a new SKU.
   * If it was reconstructed from soft-deleted data (isActive === false),
   * reactivate it via the create endpoint (which the service maps to a
   * reactivation). Returns the active option, or null on failure.
   */
  async function ensureActiveSizeOption(): Promise<ProductOption | null> {
    if (sizeOption?.isActive) return sizeOption;

    const res = await apiClient.post<ProductOption>(
      `/api/products/${productId}/options`,
      {
        name: sizeOption?.name ?? 'Size',
        type: 'TEXT',
        isRequired: true,
        isVariant: true,
        displayOrder: 0,
      }
    );
    if (res.success && 'data' in res) {
      const active = { ...res.data, isActive: true };
      setSizeOption(active);
      return active;
    }
    showToast(res.message || 'Failed to activate Size option', 'error');
    return null;
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [productRes, catsRes, optionsRes] = await Promise.all([
        apiClient.get<Product>(`/api/products/${productId}`),
        apiClient.get<Category[]>('/api/categories'),
        apiClient.get<ProductOption[]>(`/api/products/${productId}/options`),
      ]);

      if (!productRes.success) {
        setError(productRes.message || 'Product not found');
        setLoading(false);
        return;
      }

      const p = productRes.data;
      setName(p.name);
      setCategoryId(p.categoryId ?? '');
      setHsnCode(p.hsnCode ?? '');
      setDescription(p.description ?? '');
      setImages([p.images?.[0] ?? '', p.images?.[1] ?? '', p.images?.[2] ?? '']);

      if (catsRes.success) setCategories(catsRes.data);

      const loadedSkus = await loadSkus();

      const activeOptions = optionsRes.success ? optionsRes.data : [];
      setSizeOption(deriveSizeOption(activeOptions, loadedSkus));

      setLoading(false);
    }
    init();
  }, [productId, loadSkus]);

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setSavingProduct(true);
    const res = await apiClient.patch(`/api/products/${productId}`, {
      name: name.trim(),
      categoryId: categoryId || undefined,
      hsnCode: hsnCode.trim() || undefined,
      description: description.trim() || undefined,
      images: images.filter(Boolean),
    });
    setSavingProduct(false);
    if (res.success) showToast('Product saved', 'success');
    else showToast(res.message || 'Failed to save product', 'error');
  }

  function updateSkuField(id: string, field: '_price' | '_mrp' | '_qty', value: string) {
    setSkus((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  async function saveSku(sku: Sku) {
    setSkus((prev) => prev.map((s) => (s.id === sku.id ? { ...s, _saving: true } : s)));

    // 1. Update price/mrp
    const patch = await apiClient.patch(`/api/product-items/${sku.id}`, {
      sellingPrice: Number(sku._price || 0),
      mrp: sku._mrp ? Number(sku._mrp) : null,
    });

    // 2. Adjust stock if quantity changed
    let stockOk = true;
    if (Number(sku._qty) !== sku.stockLevel) {
      const adj = await apiClient.post('/api/stock-adjustments', {
        productItemId: sku.id,
        quantity: Number(sku._qty || 0),
      });
      stockOk = adj.success;
    }

    setSkus((prev) => prev.map((s) => (s.id === sku.id ? { ...s, _saving: false } : s)));

    if (patch.success && stockOk) {
      showToast(`${sku.sku} updated`, 'success');
      await loadSkus();
    } else {
      showToast(
        (!patch.success && patch.message) || 'Failed to update SKU',
        'error'
      );
    }
  }

  async function setSkuStatus(sku: Sku, status: 'ACTIVE' | 'DISCONTINUED') {
    const res = await apiClient.patch(`/api/product-items/${sku.id}`, {
      status,
    });
    if (res.success) {
      showToast(
        `${sku.sku} ${status === 'ACTIVE' ? 'reactivated' : 'discontinued'}`,
        'success'
      );
      await loadSkus();
    } else {
      showToast(res.message || 'Failed to update status', 'error');
    }
  }

  async function deleteSku() {
    if (!skuToDelete) return;
    setDeletingSku(true);
    const res = await apiClient.delete(`/api/product-items/${skuToDelete.id}`);
    setDeletingSku(false);
    if (res.success) {
      showToast(`${skuToDelete.sku} deleted`, 'success');
      setSkuToDelete(null);
      await loadSkus();
    } else {
      // e.g. the SKU has purchase/sale history and can't be hard-deleted.
      showToast(res.message || 'Failed to delete size', 'error');
      setSkuToDelete(null);
    }
  }

  async function createSizeOption() {
    setCreatingSizeOption(true);
    // Creating an option named "Size" reactivates a soft-deleted one if it was
    // previously removed, restoring any values that were attached to it.
    const res = await apiClient.post<ProductOption>(
      `/api/products/${productId}/options`,
      { name: 'Size', type: 'TEXT', isRequired: true, isVariant: true, displayOrder: 0 }
    );
    setCreatingSizeOption(false);
    if (res.success && 'data' in res) {
      setSizeOption({ ...res.data, isActive: true });
      showToast('Size option added', 'success');
      await loadSkus();
    } else {
      showToast(res.message || 'Failed to add Size option', 'error');
    }
  }

  async function addSize(e: FormEvent) {
    e.preventDefault();
    if (!sizeOption) {
      showToast('This product has no Size option to add variants to.', 'error');
      return;
    }
    setAddingSize(true);

    // 0. The Size option may have been soft-deleted (reconstructed from the
    //    existing SKUs). New SKUs can only attach to an ACTIVE option, so
    //    reactivate it first.
    const option = await ensureActiveSizeOption();
    if (!option) {
      setAddingSize(false);
      return;
    }

    // 1. Create the option value (size label). Reactivates if soft-deleted.
    const valueRes = await apiClient.post<{ id: string }>(
      `/api/products/${productId}/options/${option.id}/values`,
      { value: newSize.trim(), displayOrder: skus.length }
    );

    if (!valueRes.success) {
      setAddingSize(false);
      showToast(valueRes.message || 'Failed to add size', 'error');
      return;
    }

    // 2. Create the SKU linked to that value.
    const itemRes = await apiClient.post<{ id: string }>('/api/product-items', {
      productId,
      sku: newSku.trim(),
      sellingPrice: Number(newPrice || 0),
      purchasePrice: 0,
      optionValues: [
        { optionId: option.id, optionValueId: valueRes.data.id },
      ],
    });

    if (!itemRes.success) {
      setAddingSize(false);
      showToast(itemRes.message || 'Failed to create SKU', 'error');
      return;
    }

    // 3. Opening stock if provided.
    if (Number(newQty) > 0) {
      await apiClient.post('/api/stock-adjustments', {
        productItemId: itemRes.data.id,
        quantity: Number(newQty),
      });
    }

    setAddingSize(false);
    setNewSize('');
    setNewSku('');
    setNewPrice('');
    setNewQty('0');
    showToast('Size added', 'success');
    await loadSkus();
  }

  const inputCls =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/products')}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Back to products"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900">Edit product</h1>
      </div>

      {/* Product details */}
      <form
        onSubmit={saveProduct}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-6"
      >
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
              disabled={!canManage}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              disabled={!canManage}
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
              disabled={!canManage}
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="desc" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="desc"
              disabled={!canManage}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
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
                onChange={(u) =>
                  setImages((prev) => prev.map((v, idx) => (idx === i ? u : v)))
                }
                label={`Image ${i + 1}`}
                disabled={!canManage || savingProduct}
              />
            ))}
          </div>
        </div>

        {canManage && (
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingProduct}
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingProduct ? 'Saving…' : 'Save product'}
            </button>
          </div>
        )}
      </form>

      {/* SKUs / sizes */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sizes & stock
        </h2>

        {skus.length === 0 ? (
          <p className="text-sm text-gray-400">No sizes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-2">Size</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">MRP</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Status</th>
                  {canManage && <th className="px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {skus.map((s) => {
                  const sizeLabel =
                    s.optionValues.map((v) => v.value).join(' / ') || '—';
                  return (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="px-2 py-2 font-semibold text-gray-800">
                        {sizeLabel}
                      </td>
                      <td className="px-2 py-2 text-gray-600">{s.sku}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!canManage}
                          value={s._price}
                          onChange={(e) => updateSkuField(s.id, '_price', e.target.value)}
                          className={`${inputCls} max-w-[110px]`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!canManage}
                          value={s._mrp}
                          onChange={(e) => updateSkuField(s.id, '_mrp', e.target.value)}
                          className={`${inputCls} max-w-[110px]`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!canManage}
                          value={s._qty}
                          onChange={(e) => updateSkuField(s.id, '_qty', e.target.value)}
                          className={`${inputCls} max-w-[90px]`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={s.status} />
                      </td>
                      {canManage && (
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={s._saving}
                              onClick={() => saveSku(s)}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              {s._saving ? 'Saving…' : 'Save'}
                            </button>
                            {s.status === 'DISCONTINUED' ? (
                              <button
                                type="button"
                                onClick={() => setSkuStatus(s, 'ACTIVE')}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSkuStatus(s, 'DISCONTINUED')}
                                className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                              >
                                Discontinue
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSkuToDelete(s)}
                              className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* No Size option — offer to (re)create it. This recovers the page
            when the Size option was accidentally deleted. */}
        {canManage && !sizeOption && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
            <p className="text-sm text-gray-500">
              This product has no Size option, so sizes can&apos;t be added.
            </p>
            <button
              type="button"
              disabled={creatingSizeOption}
              onClick={createSizeOption}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {creatingSizeOption ? 'Adding…' : '+ Add Size option'}
            </button>
          </div>
        )}

        {/* Add size */}
        {canManage && sizeOption && (
          <form
            onSubmit={addSize}
            className="mt-5 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-5"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">New size</label>
              <input
                required
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                className={`${inputCls} max-w-[110px]`}
                placeholder="XXL"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">SKU</label>
              <input
                required
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                className={`${inputCls} max-w-[150px]`}
                placeholder="TEE-XXL"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Price</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${inputCls} max-w-[110px]`}
                placeholder="799"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Opening qty</label>
              <input
                type="number"
                min="0"
                step="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className={`${inputCls} max-w-[90px]`}
              />
            </div>
            <button
              type="submit"
              disabled={addingSize}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {addingSize ? 'Adding…' : '+ Add size'}
            </button>
          </form>
        )}
      </section>

      <ConfirmDialog
        isOpen={skuToDelete !== null}
        title="Delete size?"
        description={
          skuToDelete
            ? `Permanently delete "${skuToDelete.sku}"? This can't be undone. Sizes with purchase or sale history can't be deleted — discontinue them instead.`
            : ''
        }
        onConfirm={deleteSku}
        onCancel={() => {
          if (!deletingSku) setSkuToDelete(null);
        }}
      />
    </div>
  );
}
