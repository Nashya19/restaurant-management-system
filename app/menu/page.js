'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listAllMenuItems,
  listCategories,
  toggleMenuItemAvailability,
  archiveMenuItem,
  restoreMenuItem,
} from '@/lib/api/menu';
import { resetDailyMenuItemsAvailability } from '@/lib/actions/menu';
import { formatCurrency } from '@/lib/utils/formatters';
import { getCartItemsAction, updateCartItemAction } from '@/lib/actions/cart';
import { Edit2, Archive, RotateCcw, ToggleLeft, ToggleRight, Plus, Search, Loader2, ChevronDown, ChevronRight, ShoppingCart, Minus, CheckCircle2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';
import { createClient } from '@/lib/supabase/client';

export default function MenuPage() {
  const supabase = createClient();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devRole, setDevRole] = useState('admin');

  // Local selection state — user picks quantities, then clicks "Add to Cart"
  const [orderQuantities, setOrderQuantities] = useState({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [bottomError, setBottomError] = useState(null);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const router = useRouter();

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const getISTDateString = () => {
    const utcDate = new Date();
    const istTime = new Date(utcDate.getTime() + 5.5 * 60 * 60 * 1000);
    return istTime.toISOString().split('T')[0];
  };

  const checkDailyReset = async () => {
    const todayIST = getISTDateString();
    const lastResetDate = localStorage.getItem('last-menu-reset-date');
    if (lastResetDate !== todayIST) {
      try {
        await resetDailyMenuItemsAvailability();
        localStorage.setItem('last-menu-reset-date', todayIST);
      } catch (err) {
        console.error('Failed to run daily menu availability reset:', err);
      }
    }
  };

  // Fetch menu data on mount; check session status for customers
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const role = localStorage.getItem('dev-role') || 'admin';
        setDevRole(role);

        if (role === 'customer') {
          const sessionId = localStorage.getItem('sessionId');
          const tableNumber = localStorage.getItem('tableNumber');
          if (sessionId && tableNumber) {
            const { getSessionDetailsAction } = await import('@/lib/actions/orders');
            const sessionData = await getSessionDetailsAction(sessionId);
            if (sessionData.status === 'completed' || sessionData.status === 'locked') {
              window.location.href = `/table/${tableNumber}/order`;
              return;
            }
          }
        }

        if (role !== 'customer') {
          await checkDailyReset();
        }

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

  // Listen for session status changes (kicked out when locked/completed/cleared)
  useEffect(() => {
    const role = localStorage.getItem('dev-role') || 'admin';
    const sessionId = localStorage.getItem('sessionId');
    const tableNumber = localStorage.getItem('tableNumber');

    if (role !== 'customer' || !sessionId || !tableNumber) return;

    const sessionChannel = supabase
      .channel('menu_table_session_tracker')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.new) {
            const newStatus = payload.new.status;
            if (newStatus === 'locked' || newStatus === 'completed') {
              window.location.href = `/table/${tableNumber}/order`;
            } else if (newStatus === 'cleared') {
              localStorage.removeItem('sessionId');
              localStorage.removeItem('tableNumber');
              localStorage.removeItem('dev-role');
              window.location.href = `/table/${tableNumber}`;
            }
          }
        }
      )
      .subscribe();

    return () => sessionChannel.unsubscribe();
  }, [supabase]);

  // Filter / search
  useEffect(() => {
    let result = items;
    if (devRole !== 'admin') result = result.filter(item => !item.is_archived);
    if (selectedCategory !== 'all') result = result.filter(item => item.category_id === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }
    setFilteredItems(result);
  }, [selectedCategory, searchQuery, items, devRole]);

  const groupedItems = useMemo(() => {
    const groups = {};
    categories.forEach(cat => { groups[cat.id] = { category: cat, items: [] }; });
    groups['uncategorized'] = { category: { id: 'uncategorized', name: 'Uncategorized' }, items: [] };

    filteredItems.forEach(item => {
      const catId = item.category_id || 'uncategorized';
      if (!groups[catId]) {
        groups[catId] = { category: item.categories || { id: catId, name: 'Uncategorized' }, items: [] };
      }
      groups[catId].items.push(item);
    });

    if (groups['uncategorized'].items.length === 0) delete groups['uncategorized'];
    return Object.values(groups).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [filteredItems, categories]);

  const handleToggleAvailability = async (itemId) => {
    try {
      const updated = await toggleMenuItemAvailability(itemId);
      setItems(items.map(item => item.id === itemId ? updated : item));
    } catch (err) { setError(err.message); }
  };

  const handleArchive = (itemId, itemName) => {
    setConfirmDialog({
      isOpen: true, title: 'Archive Item', message: `Archive "${itemName}"?`,
      confirmText: 'Archive', confirmStyle: 'btn-danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const updated = await archiveMenuItem(itemId);
          setItems(items.map(item => item.id === itemId ? updated : item));
        } catch (err) { setError(err.message); }
      }
    });
  };

  const handleRestore = (itemId, itemName) => {
    setConfirmDialog({
      isOpen: true, title: 'Restore Item', message: `Restore "${itemName}"?`,
      confirmText: 'Restore', confirmStyle: 'btn-success',
      onConfirm: async () => {
        closeConfirm();
        try {
          const updated = await restoreMenuItem(itemId);
          setItems(items.map(item => item.id === itemId ? updated : item));
        } catch (err) { setError(err.message); }
      }
    });
  };

  const toggleCategoryCollapse = (catId) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Local-only quantity update (no DB call — just for selection UI)
  const updateQuantity = (itemId, delta) => {
    setOrderQuantities(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev, [itemId]: next };
      if (next === 0) delete updated[itemId];
      return updated;
    });
  };

  const handleQuantityInputChange = (itemId, value) => {
    const parsed = parseInt(value, 10);
    const next = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setOrderQuantities(prev => {
      const updated = { ...prev, [itemId]: next };
      if (next === 0) delete updated[itemId];
      return updated;
    });
  };

  const orderSummary = useMemo(() => {
    let totalItems = 0;
    let totalPrice = 0;
    const selectedList = [];
    Object.entries(orderQuantities).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          totalItems += qty;
          totalPrice += item.price * qty;
          selectedList.push({ item, qty });
        }
      }
    });
    return { totalItems, totalPrice, selectedList };
  }, [orderQuantities, items]);

  /**
   * "Add to Cart" — merges local selection into the shared DB cart.
   * Existing cart items for the same menu_item_id get their quantity incremented.
   */
  const handleAddToCart = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      setBottomError('No active session. Please join the table again.');
      return;
    }

    const itemsToAdd = Object.entries(orderQuantities).filter(([, qty]) => qty > 0);
    if (itemsToAdd.length === 0) return;

    setIsAddingToCart(true);
    setBottomError(null);

    try {
      // Fetch current DB cart to merge (add to) existing quantities
      const currentCart = await getCartItemsAction(sessionId);
      const existingQtyMap = {};
      currentCart.forEach(ci => { existingQtyMap[ci.menu_item_id] = ci.quantity; });

      // Upsert each item: add selected qty to whatever is already in the cart
      await Promise.all(
        itemsToAdd.map(([itemId, qty]) => {
          const mergedQty = (existingQtyMap[itemId] || 0) + qty;
          return updateCartItemAction(sessionId, itemId, mergedQty);
        })
      );

      setAddedToCart(true);
      setOrderQuantities({});
      setTimeout(() => setAddedToCart(false), 4000);
    } catch (err) {
      console.error('[CART] Failed to add to cart:', err);
      setBottomError(err.message || 'Failed to add to cart. Please try again.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#27272a]">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {devRole === 'customer' ? 'Browse Menu' : 'Menu Items'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {devRole === 'customer'
              ? 'Select items and tap Add to Cart. Review your cart on the Orders page.'
              : 'Create, update, and manage menu items. Set pricing, prep times, and availability states.'}
          </p>
        </div>
        {devRole === 'admin' && (
          <Link href="/menu/new" className="btn btn-primary btn-premium flex items-center justify-center gap-2 rounded-xl font-bold shadow-md shadow-[var(--accent)]/5">
            <Plus size={18} />
            Create Item
          </Link>
        )}
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
          <div className="space-y-2">
            <label htmlFor="category" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
              Filter by Category
            </label>
            <CustomSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map(cat => ({ value: cat.id, label: cat.name }))
              ]}
            />
          </div>
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
                onChange={e => setSearchQuery(e.target.value)}
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
            if (groupItems.length === 0) return null;

            return (
              <div key={category.id} className="card bg-[#18181b] border border-[#27272a] rounded-2xl shadow-lg overflow-hidden p-0 transition-all duration-300">
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="w-full flex items-center justify-between p-5 bg-[#09090b]/40 hover:bg-[#09090b]/80 transition-colors text-left cursor-pointer border-b border-[#27272a]/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-md font-bold text-[var(--text-primary)] capitalize">{category.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#27272a] text-[var(--text-secondary)]">
                      {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5 text-xs font-semibold hover:text-[var(--accent)]">
                    <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto animate-fade-in">
                    <table className="w-full">
                      <thead className="bg-[#09090b]/30 border-b border-[#27272a]">
                        <tr>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">Name</th>
                          <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">Price</th>
                          {devRole !== 'customer' && (
                            <>
                              <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">Prep Time</th>
                              <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">Status</th>
                            </>
                          )}
                          <th className={`${devRole === 'customer' ? 'text-center' : 'text-right'} text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider`}>
                            {devRole === 'customer' ? 'Qty' : 'Actions'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272a]/60">
                        {groupItems.map(item => (
                          <tr
                            key={item.id}
                            className={`hover:bg-[#09090b]/20 transition-colors ${item.is_archived ? 'opacity-50' : ''} ${devRole === 'customer' && !item.is_available ? 'opacity-60 bg-[#121214]/50' : ''}`}
                          >
                            <td className={`px-6 py-4 text-sm font-semibold ${item.is_archived ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                              <div>
                                <span>{item.name}</span>
                                {devRole === 'customer' && !item.is_available && (
                                  <span className="block text-[10px] text-red-500 font-bold uppercase mt-0.5 tracking-wider">Unavailable Today</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm font-semibold text-[var(--accent)]">
                              {formatCurrency(item.price)}
                            </td>
                            {devRole !== 'customer' && (
                              <>
                                <td className="px-6 py-4 text-sm font-medium text-[var(--text-secondary)]">{item.prep_time_minutes} min</td>
                                <td className="px-6 py-4">
                                  {item.is_archived ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#242424] text-[var(--text-secondary)]">Archived</span>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${item.is_available ? 'bg-[#0f2318] text-[#4a9b6a]' : 'bg-[#2a1010] text-[#c45a5a]'}`}>
                                      {item.is_available ? 'Available' : 'Unavailable'}
                                    </span>
                                  )}
                                </td>
                              </>
                            )}
                            <td className="px-6 py-4">
                              {devRole === 'customer' ? (
                                <div className="flex items-center justify-center gap-2">
                                  {item.is_available ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="w-8 h-8 rounded-lg bg-[#09090b] hover:bg-[#27272a] border border-[#27272a] flex items-center justify-center text-[var(--text-primary)] transition-all cursor-pointer"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <input
                                        type="text"
                                        value={orderQuantities[item.id] || 0}
                                        onChange={e => handleQuantityInputChange(item.id, e.target.value)}
                                        className="w-12 h-8 bg-[#09090b] border border-[#27272a] rounded-lg text-center text-sm font-semibold focus:outline-none focus:border-[var(--accent)]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(item.id, 1)}
                                        className="w-8 h-8 rounded-lg bg-[#09090b] hover:bg-[#27272a] border border-[#27272a] flex items-center justify-center text-[var(--text-primary)] transition-all cursor-pointer"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-[var(--text-muted)] font-semibold italic">Unavailable</span>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 float-right">
                                  {devRole === 'admin' && (
                                    <Link href={`/menu/${item.id}`} className="btn bg-[#09090b] border-[#27272a] hover:bg-[#18181b] text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
                                      <Edit2 size={13} /><span>Edit</span>
                                    </Link>
                                  )}
                                  {!item.is_archived && (
                                    <button onClick={() => handleToggleAvailability(item.id)} title="Toggle Availability" className="btn bg-[#09090b] border-[#27272a] hover:bg-[#18181b] text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center cursor-pointer">
                                      {item.is_available ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} className="text-gray-500" />}
                                    </button>
                                  )}
                                  {devRole === 'admin' && (
                                    <>
                                      {!item.is_archived ? (
                                        <button onClick={() => handleArchive(item.id, item.name)} className="btn border border-red-950 bg-[#2a1010] text-[#c45a5a] hover:bg-red-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
                                          <Archive size={13} /><span>Archive</span>
                                        </button>
                                      ) : (
                                        <button onClick={() => handleRestore(item.id, item.name)} className="btn border border-green-950 bg-[#0f2318] text-[#4a9b6a] hover:bg-green-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
                                          <RotateCcw size={13} /><span>Restore</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
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

      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-semibold px-2">
        <span>Showing {filteredItems.length} of {items.length} menu items</span>
      </div>

      {/* Sticky Bottom: "Add to Cart" bar — only for customers with items selected */}
      {devRole === 'customer' && orderSummary.totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-[#18181b] border-t border-[#27272a] shadow-2xl z-50 animate-slide-up">
          {/* Inline error */}
          {bottomError && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-2 text-[#c45a5a] text-xs font-semibold bg-[#2a1010] border-b border-[#5a2020]/50">
              <span className="shrink-0">⚠️</span>
              <span>{bottomError}</span>
            </div>
          )}
          {/* Success banner */}
          {addedToCart && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-2 text-[#4a9b6a] text-xs font-semibold bg-[#0f2318] border-b border-[#205a30]/50">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Added to cart! <Link href={`/table/${localStorage.getItem('tableNumber') || ''}/order`} className="underline font-bold">View cart →</Link></span>
            </div>
          )}
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-raised)] border border-[#27272a] flex items-center justify-center text-[var(--accent)]">
                <ShoppingCart size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {orderSummary.totalItems} item{orderSummary.totalItems !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-[var(--text-secondary)] font-semibold">
                  Subtotal: <span className="text-[var(--accent)] font-mono font-bold">{formatCurrency(orderSummary.totalPrice)}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAddingToCart || addedToCart}
              className="btn btn-primary btn-premium px-6 py-2.5 h-10 rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--accent)]/10 disabled:opacity-60 shrink-0"
            >
              {isAddingToCart ? (
                <><Loader2 size={16} className="animate-spin" /><span>Adding…</span></>
              ) : addedToCart ? (
                <><CheckCircle2 size={16} /><span>Added!</span></>
              ) : (
                <><ShoppingCart size={16} /><span>Add to Cart</span></>
              )}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
    </div>
  );
}
