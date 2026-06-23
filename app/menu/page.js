/**
 * /app/menu/page.js
 * 
 * Menu items list page (admin view)
 * Displays all menu items with:
 * - Table: Name, Category, Price, Prep Time, Availability, Archived, Actions
 * - Filter by category (dropdown)
 * - Search by name
 * - Create button
 * - Edit/Archive/Delete (toggle availability) actions
 * 
 * DESIGN COMPLIANCE:
 * - Dark theme
 * - Prices in `.text-data` (JetBrains Mono)
 * - Availability shown as `.badge-open` (available) or `.badge-inactive` (unavailable)
 * - Archived items dimmed (text-muted, strikethrough name)
 * - Category shown as category name
 * - Prep time in minutes
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listAllMenuItems,
  listCategories,
  searchMenuItems,
  toggleMenuItemAvailability,
  archiveMenuItem,
  restoreMenuItem,
} from '@/lib/api/menu';
import { formatCurrency, getStatusBadgeClass } from '@/lib/utils/formatters';
import { Edit2, Archive, RotateCcw, ToggleLeft, Plus, Search } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const router = useRouter();

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // Fetch categories and items on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [itemsData, categoriesData] = await Promise.all([
          listAllMenuItems(),
          listCategories(),
        ]);
        setItems(itemsData);
        setCategories(categoriesData);
        setFilteredItems(itemsData);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch menu:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle filter and search
  useEffect(() => {
    let result = items;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((item) => item.category_id === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(query));
    }

    setFilteredItems(result);
  }, [selectedCategory, searchQuery, items]);

  // Handle toggle availability
  const handleToggleAvailability = async (itemId) => {
    try {
      const updated = await toggleMenuItemAvailability(itemId);
      setItems(items.map((item) => (item.id === itemId ? updated : item)));
    } catch (err) {
      setError(err.message);
      console.error('Failed to toggle availability:', err);
    }
  };

  // Handle archive
  const handleArchive = (itemId, itemName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Archive Item',
      message: `Archive "${itemName}"?`,
      confirmText: 'Archive',
      confirmStyle: 'btn-danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const updated = await archiveMenuItem(itemId);
          setItems(items.map((item) => (item.id === itemId ? updated : item)));
        } catch (err) {
          setError(err.message);
          console.error('Failed to archive item:', err);
        }
      }
    });
  };

  // Handle restore
  const handleRestore = (itemId, itemName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restore Item',
      message: `Restore "${itemName}"?`,
      confirmText: 'Restore',
      confirmStyle: 'btn-success',
      onConfirm: async () => {
        closeConfirm();
        try {
          const updated = await restoreMenuItem(itemId);
          setItems(items.map((item) => (item.id === itemId ? updated : item)));
        } catch (err) {
          setError(err.message);
          console.error('Failed to restore item:', err);
        }
      }
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display text-[var(--text-primary)] mb-2">Menu Items</h1>
          <p className="text-body text-[var(--text-secondary)]">
            Create and manage menu items. Set pricing, prep times, and availability.
          </p>
        </div>
        <Link href="/menu/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          Create Item
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="card bg-[var(--destructive-bg)] border-[var(--destructive-border)] text-[var(--destructive)] p-4 mb-6">
          <p className="text-body">⚠️ {error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Filter */}
          <div>
            <label htmlFor="category" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
              Filter by Category
            </label>
            <CustomSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name }))
              ]}
            />
          </div>

          {/* Search */}
          <div>
            <label htmlFor="search" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
              Search Items
            </label>
            <div className="flex items-center gap-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-3 py-2">
              <Search size={16} className="text-[var(--text-secondary)]" />
              <input
                id="search"
                type="text"
                placeholder="By name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading menu items…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--text-secondary)]">
              {items.length === 0 ? 'No menu items yet.' : 'No items match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Category
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Price
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Prep Time
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Status
                  </th>
                  <th className="text-right text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--surface-raised)] transition-colors ${
                      item.is_archived ? 'opacity-60' : ''
                    }`}
                  >
                    <td className={`text-body px-6 py-4 ${item.is_archived ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {item.name}
                    </td>
                    <td className="text-body text-[var(--text-secondary)] px-6 py-4">
                      {item.categories?.name || '—'}
                    </td>
                    <td className="text-data px-6 py-4 font-mono text-[var(--text-primary)]">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="text-body text-[var(--text-secondary)] px-6 py-4">
                      {item.prep_time_minutes} min
                    </td>
                    <td className="text-body px-6 py-4">
                      {item.is_archived ? (
                        <span className="badge badge-inactive">Archived</span>
                      ) : (
                        <span className={`badge ${item.is_available ? 'badge-open' : 'badge-inactive'}`}>
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      )}
                    </td>
                    <td className="text-body px-6 py-4 flex justify-end gap-2">
                      <Link
                        href={`/menu/${item.id}`}
                        className="btn btn-ghost inline-flex items-center gap-1 px-3 py-2"
                      >
                        <Edit2 size={16} />
                        Edit
                      </Link>
                      {!item.is_archived && (
                        <button
                          onClick={() => handleToggleAvailability(item.id)}
                          className="btn btn-ghost inline-flex items-center gap-1 px-3 py-2"
                        >
                          <ToggleLeft size={16} />
                        </button>
                      )}
                      {!item.is_archived ? (
                        <button
                          onClick={() => handleArchive(item.id, item.name)}
                          className="btn btn-danger inline-flex items-center gap-1 px-3 py-2"
                        >
                          <Archive size={16} />
                          Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(item.id, item.name)}
                          className="btn btn-success inline-flex items-center gap-1 px-3 py-2"
                        >
                          <RotateCcw size={16} />
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-small text-[var(--text-muted)]">
        Showing <span className="font-semibold">{filteredItems.length}</span> of{' '}
        <span className="font-semibold">{items.length}</span> items
      </div>

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={closeConfirm} 
      />
    </div>
  );
}
