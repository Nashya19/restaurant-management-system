'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Edit2, Archive, RotateCcw, ToggleLeft, ToggleRight, Plus, Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
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
  
  // Accordion collapsed state: keys are category IDs, values are boolean
  const [collapsedCategories, setCollapsedCategories] = useState({});

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

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = {};

    categories.forEach((cat) => {
      groups[cat.id] = {
        category: cat,
        items: []
      };
    });

    groups['uncategorized'] = {
      category: { id: 'uncategorized', name: 'Uncategorized' },
      items: []
    };

    filteredItems.forEach((item) => {
      const catId = item.category_id || 'uncategorized';
      if (!groups[catId]) {
        groups[catId] = {
          category: item.categories || { id: catId, name: 'Uncategorized' },
          items: []
        };
      }
      groups[catId].items.push(item);
    });

    if (groups['uncategorized'].items.length === 0) {
      delete groups['uncategorized'];
    }

    return Object.values(groups).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [filteredItems, categories]);

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

  const toggleCategoryCollapse = (catId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#27272a]">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Menu Items</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Create, update, and manage menu items. Set pricing, prep times, and availability states.
          </p>
        </div>
        <Link href="/menu/new" className="btn btn-primary btn-premium flex items-center justify-center gap-2 rounded-xl font-bold shadow-md shadow-[var(--accent)]/5">
          <Plus size={18} />
          Create Item
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 bg-[#2a1010] border border-[#5a2020] text-[#c45a5a] text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filters Card */}
      <div className="card bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Filter */}
          <div className="space-y-2">
            <label htmlFor="category" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
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
          <div className="space-y-2">
            <label htmlFor="search" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
              Search Items
            </label>
            <div className="flex items-center gap-2.5 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 h-10 transition-colors focus-within:border-[var(--accent)]">
              <Search size={16} className="text-[var(--text-secondary)]" />
              <input
                id="search"
                type="text"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none p-0 outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Groups */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="card bg-[#18181b] border border-[#27272a] p-16 text-center rounded-2xl shadow-lg">
            <Loader2 size={36} className="animate-spin text-[var(--accent)] inline-block" />
            <p className="mt-4 text-sm text-[var(--text-secondary)] font-medium">Loading menu items…</p>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="card bg-[#18181b] border border-[#27272a] p-16 text-center rounded-2xl shadow-lg">
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              {items.length === 0 ? 'No menu items configured yet.' : 'No items match your selected filters.'}
            </p>
          </div>
        ) : (
          groupedItems.map(({ category, items: groupItems }) => {
            const isCollapsed = !!collapsedCategories[category.id];
            
            // If filtering by category, don't show empty categories
            if (groupItems.length === 0 && selectedCategory !== 'all') {
              return null;
            }
            if (groupItems.length === 0 && selectedCategory === 'all') {
              return null;
            }

            return (
              <div key={category.id} className="card bg-[#18181b] border border-[#27272a] rounded-2xl shadow-lg overflow-hidden p-0 transition-all duration-300">
                {/* Collapsible Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="w-full flex items-center justify-between p-5 bg-[#09090b]/40 hover:bg-[#09090b]/80 transition-colors text-left cursor-pointer border-b border-[#27272a]/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-md font-bold text-[var(--text-primary)] capitalize">
                      {category.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#27272a] text-[var(--text-secondary)]">
                      {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5 text-xs font-semibold hover:text-[var(--accent)]">
                    <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* Collapsible Items Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto animate-fade-in">
                    <table className="w-full">
                      <thead className="bg-[#09090b]/30 border-b border-[#27272a]">
                        <tr>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                            Name
                          </th>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                            Price
                          </th>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                            Prep Time
                          </th>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                            Status
                          </th>
                          <th className="text-right text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272a]/60">
                        {groupItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`hover:bg-[#09090b]/20 transition-colors ${
                              item.is_archived ? 'opacity-50' : ''
                            }`}
                          >
                            <td className={`px-6 py-4 text-sm font-semibold ${item.is_archived ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                              {item.name}
                            </td>
                            <td className="px-6 py-4 font-mono text-sm font-semibold text-[var(--accent)]">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-[var(--text-secondary)]">
                              {item.prep_time_minutes} min
                            </td>
                            <td className="px-6 py-4">
                              {item.is_archived ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#242424] text-[var(--text-secondary)]">Archived</span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${item.is_available ? 'bg-[#0f2318] text-[#4a9b6a]' : 'bg-[#2a1010] text-[#c45a5a]'}`}>
                                  {item.is_available ? 'Available' : 'Unavailable'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <Link
                                  href={`/menu/${item.id}`}
                                  className="btn bg-[#09090b] border-[#27272a] hover:bg-[#18181b] text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </Link>
                                {!item.is_archived && (
                                  <button
                                    onClick={() => handleToggleAvailability(item.id)}
                                    title="Toggle Availability"
                                    className="btn bg-[#09090b] border-[#27272a] hover:bg-[#18181b] text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center cursor-pointer"
                                  >
                                    {item.is_available ? (
                                      <ToggleRight size={15} className="text-green-500" />
                                    ) : (
                                      <ToggleLeft size={15} className="text-gray-500" />
                                    )}
                                  </button>
                                )}
                                {!item.is_archived ? (
                                  <button
                                    onClick={() => handleArchive(item.id, item.name)}
                                    className="btn border border-red-950 bg-[#2a1010] text-[#c45a5a] hover:bg-red-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Archive size={13} />
                                    <span>Archive</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRestore(item.id, item.name)}
                                    className="btn border border-green-950 bg-[#0f2318] text-[#4a9b6a] hover:bg-green-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <RotateCcw size={13} />
                                    <span>Restore</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-semibold px-2">
        <span>Showing {filteredItems.length} of {items.length} menu items</span>
      </div>

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={closeConfirm} 
      />
    </div>
  );
}
