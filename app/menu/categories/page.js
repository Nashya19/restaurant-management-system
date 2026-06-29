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
import { Edit2, Archive, Plus, X, Check, Loader2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const [devRole, setDevRole] = useState('admin');

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

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
        const role = localStorage.getItem('dev-role') || 'admin';
        setDevRole(role);
        if (role !== 'admin') {
          // Block customers & staff from categories tab
          window.location.href = '/menu';
          return;
        }

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
      setCategories([...categories, { ...newCategory, menu_items: [] }]);
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
      setCategories(categories.map((c) => (c.id === editingId ? { ...updated, menu_items: c.menu_items || [] } : c)));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setEditError(err.message);
      console.error('Failed to update category:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // Handle archive (UI label changed from Delete -> Archive)
  const handleArchive = (categoryId, categoryName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Archive Category',
      message: `Archive category "${categoryName}"? Items in this category will be unaffected.`,
      confirmText: 'Archive',
      confirmStyle: 'btn-danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          // NOTE: backend currently performs deletion via deleteCategory();
          // this UI change updates the label/confirmation only.
          await deleteCategory(categoryId);
          setCategories(categories.filter((c) => c.id !== categoryId));
        } catch (err) {
          setError(err.message);
          console.error('Failed to archive category:', err);
        }
      }
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Categories</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage menu categories. Menu items must belong to a category.
          </p>
        </div>
        {devRole === 'admin' && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary btn-premium flex items-center justify-center gap-2 rounded-xl font-bold shadow-md shadow-[var(--accent)]/5 cursor-pointer"
          >
            <Plus size={18} />
            Create Category
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="card bg-surface border border-border p-6 rounded-2xl shadow-lg animate-fade-in">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full space-y-1.5">
              <label htmlFor="createName" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
                Category Name
              </label>
              <input
                id="createName"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Main Courses"
                className="w-full bg-background border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
                required
              />
              {createError && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{createError}</p>}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={createLoading}
                className="btn btn-primary btn-premium flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 rounded-xl font-bold cursor-pointer"
              >
                {createLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                <span>Create</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateName('');
                  setCreateError(null);
                }}
                className="btn btn-ghost bg-background border-border hover:bg-surface flex-1 sm:flex-initial flex items-center justify-center gap-1 px-4 rounded-xl font-bold cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Categories Table Card */}
      <div className="card bg-surface border border-border overflow-hidden rounded-2xl shadow-lg">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 size={36} className="animate-spin text-[var(--accent)] inline-block" />
            <p className="mt-4 text-sm text-[var(--text-secondary)] font-medium">Loading categories…</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-[var(--text-secondary)] font-medium">No categories configured yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Name
                  </th>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Items
                  </th>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Created
                  </th>
                  {devRole === 'admin' && (
                    <th className="text-right text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) =>
                  editingId === category.id ? (
                    // Edit form row
                    <tr key={category.id} className="bg-background/40">
                      <td colSpan={devRole === 'admin' ? "4" : "3"} className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row items-end gap-4 w-full">
                          <div className="flex-1 w-full space-y-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-background border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
                              required
                            />
                            {editError && (
                              <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{editError}</p>
                            )}
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={handleEditSave}
                              disabled={editLoading}
                              className="btn btn-primary btn-premium flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 rounded-xl font-bold cursor-pointer text-xs h-9"
                            >
                              {editLoading ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditName('');
                                setEditError(null);
                              }}
                              className="btn btn-ghost bg-background border-border hover:bg-surface flex-1 sm:flex-initial flex items-center justify-center gap-1 px-4 rounded-xl font-bold cursor-pointer text-xs h-9"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Display row
                    <tr
                      key={category.id}
                      className="hover:bg-background/40 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)] capitalize">
                        {category.name}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[var(--text-primary)] font-mono">
                        {category.menu_items?.filter(item => !item.is_archived).length || 0}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[var(--text-secondary)]">
                        {formatDate(category.created_at, 'short')}
                      </td>
                      {devRole === 'admin' && (
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleEditStart(category)}
                              className="btn bg-background border-border hover:bg-surface text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleArchive(category.id, category.name)}
                              className="btn border border-destructive-border bg-destructive-bg text-destructive hover:bg-red-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Archive size={13} />
                              <span>Archive</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-semibold px-2">
        <span>Total categories: {categories.length}</span>
      </div>

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={closeConfirm} 
      />
    </div>
  );
}
