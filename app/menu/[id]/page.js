/**
 * /app/menu/[id]/page.js
 * 
 * Menu item create/edit page (admin only)
 * 
 * Create ([id] = "new"):
 * - Empty form
 * - Admin enters name, category, price, prep time
 * - Form creates menu_item in database
 * 
 * Edit ([id] = UUID):
 * - Fetch and pre-fill form
 * - Admin updates any field
 * - Form updates menu_item
 * 
 * DESIGN COMPLIANCE:
 * - Dark theme
 * - All inputs use standard styling
 * - Price input shows currency formatting hint
 * - Prep time shows "minutes" label
 * - Category required, select from dropdown
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  createMenuItem,
  getMenuItemById,
  updateMenuItem,
  listCategories,
} from '@/lib/api/menu';
import { useFormState } from '@/lib/hooks/useFormState';
import { validateMenuItemForm } from '@/lib/utils/validation';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function MenuItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id;
  const isNewItem = itemId === 'new';

  const [isLoading, setIsLoading] = useState(!isNewItem);
  const [categories, setCategories] = useState([]);

  const {
    formData,
    setFieldValue,
    errors,
    setFieldError,
    isLoading: formLoading,
    handleChange,
    handleSubmit: handleFormSubmit,
  } = useFormState({
    initialData: {
      name: '',
      categoryId: '',
      price: '',
      prepTime: '15',
    },
    validate: validateMenuItemForm,
    onSubmit: async (data) => {
      if (isNewItem) {
        await createMenuItem({
          name: data.name,
          categoryId: data.categoryId,
          price: data.price,
          prepTime: data.prepTime,
        });
      } else {
        await updateMenuItem(itemId, {
          name: data.name,
          categoryId: data.categoryId,
          price: data.price,
          prepTime: data.prepTime,
          isAvailable: true, // Keep unchanged
          isArchived: false, // Keep unchanged
        });
      }
    },
    onSuccess: () => {
      router.push('/menu');
    },
    onError: (err) => {
      console.error('Form submission error:', err);
    },
  });

  // Fetch categories and existing item data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const catsData = await listCategories();
        setCategories(catsData);

        if (!isNewItem) {
          const item = await getMenuItemById(itemId);
          setFieldValue('name', item.name);
          setFieldValue('categoryId', item.category_id);
          setFieldValue('price', item.price.toString());
          setFieldValue('prepTime', item.prep_time_minutes.toString());
        }
      } catch (err) {
        setFieldError('submit', err.message);
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [itemId, isNewItem, setFieldValue, setFieldError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Back Button */}
      <Link
        href="/menu"
        className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent)] mb-6 font-semibold"
      >
        <ArrowLeft size={18} />
        Back to Menu
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-display text-[var(--text-primary)] mb-2">
          {isNewItem ? 'Create Menu Item' : 'Edit Menu Item'}
        </h1>
        <p className="text-body text-[var(--text-secondary)]">
          {isNewItem
            ? 'Add a new item to the restaurant menu.'
            : 'Update menu item details.'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleFormSubmit} className="card space-y-6">
        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-[var(--destructive-bg)] border border-[var(--destructive-border)] rounded p-4">
            <p className="text-body text-[var(--destructive)]">⚠️ {errors.submit}</p>
          </div>
        )}

        {/* Name Field */}
        <div className="form-group">
          <label htmlFor="name" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Item Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Grilled Salmon"
            className="w-full"
            required
          />
          {errors.name && <p className="text-small text-[var(--destructive)] mt-1">{errors.name}</p>}
        </div>

        {/* Category Field */}
        <div className="form-group">
          <label htmlFor="categoryId" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            className="w-full"
            required
          >
            <option value="">Select a category…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="text-small text-[var(--destructive)] mt-1">{errors.categoryId}</p>
          )}
          {categories.length === 0 && (
            <p className="text-small text-[var(--text-muted)] mt-1">
              No categories available. Create one first.
            </p>
          )}
        </div>

        {/* Price Field */}
        <div className="form-group">
          <label htmlFor="price" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Price (USD)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            max="99999.99"
            value={formData.price}
            onChange={handleChange}
            placeholder="e.g., 18.99"
            className="w-full"
            required
          />
          {errors.price && <p className="text-small text-[var(--destructive)] mt-1">{errors.price}</p>}
          <p className="text-small text-[var(--text-muted)] mt-1">
            Must be a valid currency amount (max 2 decimals)
          </p>
        </div>

        {/* Prep Time Field */}
        <div className="form-group">
          <label htmlFor="prepTime" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Prep Time (Minutes)
          </label>
          <input
            id="prepTime"
            name="prepTime"
            type="number"
            min="1"
            max="1440"
            value={formData.prepTime}
            onChange={handleChange}
            placeholder="e.g., 15"
            className="w-full"
            required
          />
          {errors.prepTime && (
            <p className="text-small text-[var(--destructive)] mt-1">{errors.prepTime}</p>
          )}
          <p className="text-small text-[var(--text-muted)] mt-1">
            Estimate how long this item takes to prepare (1 min - 24 hours)
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={formLoading}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {formLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save Item'
            )}
          </button>
          <Link href="/menu" className="btn btn-ghost flex-1">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
