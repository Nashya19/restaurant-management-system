/**
 * /app/menu/categories/page.js
 * 
 * Category management page (admin only)
 * List all categories, create new, edit, delete
 * 
 * DESIGN:
 * - Similar to users list page
 * - Table with: Name, Created Date, Actions
 * - Inline edit form (click Edit, form appears, Save/Cancel)
 * - Delete with confirmation
 * - Create via modal or inline form
 */

'use client';

import { useEffect, useState } from 'react';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api/menu';
import { validateCategoryForm } from '@/lib/utils/validation';
import { formatDate } from '@/lib/utils/formatters';
import { Edit2, Trash2, Plus, X, Check, Loader2 } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listCategories();
        setCategories(data);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle create
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const errors = validateCategoryForm({ name: createName });
      if (Object.keys(errors).length > 0) {
        setCreateError(Object.values(errors)[0]);
        setCreateLoading(false);
        return;
      }

      const newCategory = await createCategory(createName);
      setCategories([...categories, newCategory]);
      setCreateName('');
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err.message);
      console.error('Failed to create category:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle edit start
  const handleEditStart = (category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditError(null);
  };

  // Handle edit save
  const handleEditSave = async () => {
    setEditError(null);
    setEditLoading(true);

    try {
      const errors = validateCategoryForm({ name: editName });
      if (Object.keys(errors).length > 0) {
        setEditError(Object.values(errors)[0]);
        setEditLoading(false);
        return;
      }

      const updated = await updateCategory(editingId, editName);
      setCategories(categories.map((c) => (c.id === editingId ? updated : c)));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setEditError(err.message);
      console.error('Failed to update category:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (categoryId, categoryName) => {
    if (!confirm(`Delete category "${categoryName}"? Items in this category will be unaffected.`)) {
      return;
    }

    try {
      await deleteCategory(categoryId);
      setCategories(categories.filter((c) => c.id !== categoryId));
    } catch (err) {
      setError(err.message);
      console.error('Failed to delete category:', err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display text-[var(--text-primary)] mb-2">Categories</h1>
          <p className="text-body text-[var(--text-secondary)]">
            Manage menu categories. Menu items must belong to a category.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Create Category
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="card bg-[var(--destructive-bg)] border-[var(--destructive-border)] text-[var(--destructive)] p-4 mb-6">
          <p className="text-body">⚠️ {error}</p>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="createName" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
                Category Name
              </label>
              <input
                id="createName"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Main Courses"
                className="w-full"
                required
              />
              {createError && <p className="text-small text-[var(--destructive)] mt-1">{createError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="btn btn-primary flex items-center gap-1 px-4"
              >
                {createLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateName('');
                  setCreateError(null);
                }}
                className="btn btn-ghost flex items-center gap-1 px-4"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Categories Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading categories…</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--text-secondary)]">No categories yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Created
                  </th>
                  <th className="text-right text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) =>
                  editingId === category.id ? (
                    // Edit form row
                    <tr key={category.id} className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                      <td colSpan="3" className="px-6 py-4">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full"
                              required
                            />
                            {editError && (
                              <p className="text-small text-[var(--destructive)] mt-1">{editError}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleEditSave}
                              disabled={editLoading}
                              className="btn btn-primary flex items-center gap-1 px-4"
                            >
                              {editLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditName('');
                                setEditError(null);
                              }}
                              className="btn btn-ghost flex items-center gap-1 px-4"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Display row
                    <tr
                      key={category.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-raised)] transition-colors"
                    >
                      <td className="text-body text-[var(--text-primary)] px-6 py-4">
                        {category.name}
                      </td>
                      <td className="text-small text-[var(--text-secondary)] px-6 py-4">
                        {formatDate(category.created_at, 'short')}
                      </td>
                      <td className="text-body px-6 py-4 flex justify-end gap-2">
                        <button
                          onClick={() => handleEditStart(category)}
                          className="btn btn-ghost inline-flex items-center gap-1 px-3 py-2"
                        >
                          <Edit2 size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.name)}
                          className="btn btn-danger inline-flex items-center gap-1 px-3 py-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-small text-[var(--text-muted)]">
        Total categories: <span className="font-semibold">{categories.length}</span>
      </div>
    </div>
  );
}
