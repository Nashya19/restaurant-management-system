'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
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
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';

function getItemImage(itemName = '', categoryName = '') {
  const name = itemName.toLowerCase();
  const cat = categoryName.toLowerCase();

  if (name.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('pasta') || name.includes('spaghetti') || name.includes('noodle')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('salad') || name.includes('soup') || name.includes('vegan')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('cake') || name.includes('dessert') || name.includes('sweet') || name.includes('ice cream') || name.includes('waffle')) return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('drink') || name.includes('beverage') || name.includes('soda') || name.includes('juice') || name.includes('coffee') || name.includes('tea') || name.includes('mocktail')) return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('chicken') || name.includes('tikka') || name.includes('kabab') || name.includes('tandoori') || name.includes('meat') || name.includes('fish')) return 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=400&h=300&q=80';
  if (name.includes('paneer') || name.includes('curry') || name.includes('masala') || name.includes('rice') || name.includes('biryani') || name.includes('naan') || name.includes('roti')) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&h=300&q=80';

  if (cat.includes('dessert')) return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&h=300&q=80';
  if (cat.includes('beverage') || cat.includes('drink')) return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&h=300&q=80';
  if (cat.includes('starter') || cat.includes('appetizer')) return 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=400&h=300&q=80';
  if (cat.includes('main')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80';

  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80';
}

export default function MenuPage() {
  useHeartbeat();
  const supabase = createClient();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [layoutMode, setLayoutMode] = useState('card');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devRole, setDevRole] = useState('admin');
  const [hideArchived, setHideArchived] = useState(true);

  // Local selection state — user picks quantities, then clicks "Add to Cart"
  const [orderQuantities, setOrderQuantities] = useState({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [bottomError, setBottomError] = useState(null);
  const [dbCart, setDbCart] = useState([]);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const router = useRouter();
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;

  const { data: menuItemsData, error: itemsError, mutate: mutateItems } = useSWR('menu-items', listAllMenuItems, { refreshInterval: 10000 });
  const { data: categoriesData, error: categoriesError, mutate: mutateCategories } = useSWR('menu-categories', listCategories, { refreshInterval: 10000 });
  const { data: cartData, mutate: mutateCart } = useSWR(
    sessionId ? ['cart-items', sessionId] : null,
    ([, sid]) => getCartItemsAction(sid)
  );

  useEffect(() => {
    if (menuItemsData) setItems(menuItemsData);
  }, [menuItemsData]);

  useEffect(() => {
    if (categoriesData) setCategories(categoriesData);
  }, [categoriesData]);

  useEffect(() => {
    if (cartData) setDbCart(cartData);
  }, [cartData]);

  useEffect(() => {
    const isSWRLoading = !menuItemsData || !categoriesData;
    setIsLoading(isSWRLoading);
    const swrError = itemsError || categoriesError;
    if (swrError) setError(swrError.message || 'Failed to load menu.');
  }, [menuItemsData, categoriesData, itemsError, categoriesError]);

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
        setLayoutMode('card');

        if (role === 'customer') {
          const sessionId = localStorage.getItem('sessionId');
          const tableNumber = localStorage.getItem('tableNumber');
          if (sessionId && tableNumber) {
            const { getSessionDetailsAction } = await import('@/lib/actions/orders');
            const sessionData = await getSessionDetailsAction(sessionId);
            if (sessionData.status === 'completed') {
              window.location.href = `/table/${tableNumber}/order`;
              return;
            }
            // Fetch DB cart items
            const cart = await getCartItemsAction(sessionId);
            setDbCart(cart);
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

  const loadDbCart = useCallback(async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;
    try {
      const cart = await getCartItemsAction(sessionId);
      setDbCart(cart);
    } catch (err) {
      console.error('Failed to reload db cart:', err);
    }
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
            if (newStatus === 'completed') {
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
    if (devRole !== 'admin') {
      result = result.filter(item => !item.is_archived);
    } else if (hideArchived) {
      result = result.filter(item => !item.is_archived);
    }
    if (selectedCategory !== 'all') result = result.filter(item => item.category_id === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }
    setFilteredItems(result);
  }, [selectedCategory, searchQuery, items, devRole, hideArchived]);

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

    // Sort items within each category group:
    // 1. Unarchived before Archived
    // 2. Available before Unavailable
    // 3. Alphabetical by name
    Object.keys(groups).forEach(catId => {
      groups[catId].items.sort((a, b) => {
        if (a.is_archived !== b.is_archived) {
          return a.is_archived ? 1 : -1;
        }
        if (a.is_available !== b.is_available) {
          return a.is_available ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    });

    if (groups['uncategorized'].items.length === 0) delete groups['uncategorized'];
    return Object.values(groups).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [filteredItems, categories]);

  const totalItemsCount = useMemo(() => {
    return items.filter(item => {
      if (devRole !== 'admin') return !item.is_archived;
      if (hideArchived) return !item.is_archived;
      return true;
    }).length;
  }, [items, devRole, hideArchived]);

  const handleToggleAvailability = async (itemId) => {
    try {
      const updated = await toggleMenuItemAvailability(itemId);
      setItems(items.map(item => item.id === itemId ? updated : item));
      mutateItems();
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
          mutateItems();
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
          mutateItems();
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

  const dbCartSummary = useMemo(() => {
    const totalItems = dbCart.reduce((sum, ci) => sum + ci.quantity, 0);
    const totalPrice = dbCart.reduce((sum, ci) => sum + (ci.menu_items?.price || 0) * ci.quantity, 0);
    return { totalItems, totalPrice };
  }, [dbCart]);

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
      await mutateCart();
      setTimeout(() => setAddedToCart(false), 4000);
    } catch (err) {
      console.error('[CART] Failed to add to cart:', err);
      setBottomError(err.message || 'Failed to add to cart. Please try again.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in pb-40">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
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
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filters Card */}
      <div className="card bg-surface border border-border p-6 rounded-2xl shadow-lg animate-fade-in">
        <div className={`grid grid-cols-1 ${devRole !== 'customer' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
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
            <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl px-3.5 h-10 transition-colors focus-within:border-[var(--accent)]">
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
          <div className="space-y-2">
            <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
              View Mode
            </label>
            <div className="flex bg-background border border-border rounded-xl p-1 h-10 w-fit">
              <button
                type="button"
                onClick={() => setLayoutMode('card')}
                className={`px-4 h-full rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${layoutMode === 'card' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'}`}
              >
                Card Grid
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`px-4 h-full rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${layoutMode === 'list' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'}`}
              >
                List Table
              </button>
            </div>
          </div>
          {devRole !== 'customer' && (
            <div className="space-y-2">
              <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                Archived Items
              </label>
              <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-3.5 h-10 w-fit select-none">
                <button
                  type="button"
                  onClick={() => setHideArchived(!hideArchived)}
                  className="flex items-center gap-2.5 cursor-pointer border-0 bg-transparent p-0 outline-none text-[var(--text-primary)]"
                >
                  {hideArchived ? (
                    <ToggleRight size={28} className="text-[var(--accent)]" />
                  ) : (
                    <ToggleLeft size={28} className="text-[var(--text-muted)]" />
                  )}
                  <span className="text-xs font-bold">Hide Archived</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Groups */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-2 scrollbar-thin space-y-6 pb-8">
        {isLoading ? (
          <div className="space-y-8 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-4">
                {/* Category Header Skeleton */}
                <div className="h-6 w-32 bg-border/60 rounded-lg"></div>
                {/* Items Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="card bg-surface border border-border/60 rounded-2xl overflow-hidden p-0 flex flex-col h-full">
                      {/* Image placeholder */}
                      <div className="h-44 w-full bg-border/60"></div>
                      {/* Content placeholder */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="h-5 w-2/3 bg-border/60 rounded-lg"></div>
                          <div className="h-3 w-full bg-border/40 rounded-lg"></div>
                          <div className="h-3 w-4/5 bg-border/40 rounded-lg"></div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <div className="h-6 w-16 bg-border/60 rounded-lg"></div>
                          <div className="h-9 w-24 bg-border/60 rounded-xl"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="card bg-surface border border-border p-16 text-center rounded-2xl shadow-lg">
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              {items.length === 0 ? 'No menu items configured yet.' : 'No items match your selected filters.'}
            </p>
          </div>
        ) : (
          groupedItems.map(({ category, items: groupItems }) => {
            const isCollapsed = !!collapsedCategories[category.id];
            if (groupItems.length === 0) return null;

            return (
              <div key={category.id} className="card bg-surface border border-border rounded-2xl shadow-lg overflow-hidden p-0 transition-all duration-300">
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="w-full flex items-center justify-between p-5 bg-background/40 hover:bg-background/80 transition-colors text-left cursor-pointer border-b border-border/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-md font-bold text-[var(--text-primary)] capitalize">{category.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-raised text-[var(--text-secondary)]">
                      {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5 text-xs font-semibold hover:text-[var(--accent)]">
                    <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {!isCollapsed && (
                  layoutMode === 'card' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-background/20 border-t border-border/40">
                      {groupItems.map(item => {
                        const quantity = orderQuantities[item.id] || 0;
                        const imageUrl = item.image_url || getItemImage(item.name, category.name);
                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col bg-surface border border-border/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${!item.is_available ? 'opacity-65 bg-background/40' : ''} ${item.is_archived ? 'opacity-50 grayscale border-dashed bg-background/30' : ''}`}
                          >
                            {/* Food Image */}
                            <div className="h-52 w-full overflow-hidden relative bg-zinc-900 border-b border-border/40">
                              <img
                                src={imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80';
                                }}
                              />
                              {!item.is_available && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <span className="text-white text-xs font-black uppercase tracking-wider bg-red-600 px-3 py-1 rounded-full border border-red-500 shadow">
                                    Unavailable
                                  </span>
                                </div>
                              )}
                              {item.is_archived && (
                                <div className="absolute top-2.5 left-2.5 z-10">
                                  <span className="text-white text-[9px] font-black uppercase tracking-wider bg-zinc-700 px-2 py-0.5 rounded border border-zinc-500 shadow">
                                    Archived
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Card Details */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                              <div className="space-y-1">
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="font-bold text-sm text-[var(--text-primary)] leading-snug line-clamp-2">
                                    {item.name}
                                  </h4>
                                  <span className="font-mono font-bold text-sm text-[var(--accent)] whitespace-nowrap">
                                    {formatCurrency(item.price)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)]">
                                  Freshly prepared in {item.prep_time_minutes} min
                                </p>
                              </div>

                              {/* Customer Controls vs Admin/Staff Action Buttons */}
                              {devRole === 'customer' ? (
                                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                                    {quantity > 0 ? `Selected: ${quantity}` : 'Add to order'}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    {item.is_available ? (
                                      <>
                                        {/* Stepper */}
                                        <div className="flex items-center gap-0 bg-[var(--background)] border border-border rounded-xl overflow-hidden shadow-inner">
                                          <button
                                            type="button"
                                            onClick={() => updateQuantity(item.id, -1)}
                                            className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer active:scale-90"
                                          >
                                            {quantity === 1 ? <Trash2 size={11} className="text-red-400" /> : <Minus size={11} />}
                                          </button>
                                          <span className="w-8 text-center text-xs font-bold text-[var(--text-primary)] tabular-nums">
                                            {quantity}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => updateQuantity(item.id, 1)}
                                            className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer active:scale-90"
                                          >
                                            <Plus size={11} />
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-xs text-[var(--text-muted)] font-semibold italic">Sold Out</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    {devRole === 'admin' && (
                                      <Link
                                        href={`/menu/${item.id}`}
                                        className="btn bg-background border-border hover:bg-surface text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer no-underline text-[var(--text-primary)]"
                                      >
                                        <Edit2 size={12} />
                                        <span>Edit</span>
                                      </Link>
                                    )}
                                    {!item.is_archived && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAvailability(item.id)}
                                        title="Toggle Availability"
                                        className="btn bg-background border-border hover:bg-surface text-[10px] px-2 h-8 rounded-lg font-bold inline-flex items-center cursor-pointer border-0"
                                      >
                                        {item.is_available ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-gray-500" />}
                                      </button>
                                    )}
                                  </div>

                                  {devRole === 'admin' && (
                                    item.is_archived ? (
                                      <button
                                        type="button"
                                        onClick={() => handleRestore(item.id, item.name)}
                                        className="btn border border-green-950 bg-success-bg text-success hover:bg-green-900 text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <RotateCcw size={12} />
                                        <span>Restore</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleArchive(item.id, item.name)}
                                        className="btn border border-destructive-border bg-destructive-bg text-destructive hover:bg-red-950 text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Archive size={12} />
                                        <span>Archive</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="overflow-x-auto animate-fade-in">
                      <table className="w-full">
                        <thead className="bg-background/30 border-b border-border">
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
                        <tbody className="divide-y divide-border/60">
                          {groupItems.map(item => (
                            <tr
                              key={item.id}
                              className={`hover:bg-background/20 transition-colors ${item.is_archived ? 'opacity-50' : ''} ${devRole === 'customer' && !item.is_available ? 'opacity-60 bg-background/50' : ''}`}
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
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-surface-raised text-[var(--text-secondary)]">Archived</span>
                                    ) : (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${item.is_available ? 'bg-success-bg text-success' : 'bg-destructive-bg text-destructive'}`}>
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
                                        {/* Stepper */}
                                        <div className="flex items-center gap-0 bg-[var(--background)] border border-border rounded-xl overflow-hidden shadow-inner">
                                          <button
                                            type="button"
                                            onClick={() => updateQuantity(item.id, -1)}
                                            className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer active:scale-90"
                                          >
                                            <Minus size={13} />
                                          </button>
                                          <input
                                            type="text"
                                            value={orderQuantities[item.id] || 0}
                                            onChange={e => handleQuantityInputChange(item.id, e.target.value)}
                                            className="w-12 h-9 bg-transparent border-x border-border text-center text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] tabular-nums"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => updateQuantity(item.id, 1)}
                                            className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer active:scale-90"
                                          >
                                            <Plus size={13} />
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-xs text-[var(--text-muted)] font-semibold italic">Unavailable</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 float-right">
                                    {devRole === 'admin' && (
                                      <Link href={`/menu/${item.id}`} className="btn bg-background border-border hover:bg-surface text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
                                        <Edit2 size={13} /><span>Edit</span>
                                      </Link>
                                    )}
                                    {!item.is_archived && (
                                      <button onClick={() => handleToggleAvailability(item.id)} title="Toggle Availability" className="btn bg-background border-border hover:bg-surface text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center cursor-pointer">
                                        {item.is_available ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} className="text-gray-500" />}
                                      </button>
                                    )}
                                    {devRole === 'admin' && (
                                      <>
                                        {!item.is_archived ? (
                                          <button onClick={() => handleArchive(item.id, item.name)} className="btn border border-destructive-border bg-destructive-bg text-destructive hover:bg-red-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
                                            <Archive size={13} /><span>Archive</span>
                                          </button>
                                        ) : (
                                          <button onClick={() => handleRestore(item.id, item.name)} className="btn border border-green-950 bg-success-bg text-success hover:bg-green-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer">
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
                  )
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-semibold px-2">
        <span>Showing {filteredItems.length} of {totalItemsCount} menu items</span>
      </div>

      {/* Sticky Bottom: Cart bar — only for customers with items selected OR in DB cart */}
      {devRole === 'customer' && (orderSummary.totalItems > 0 || dbCartSummary.totalItems > 0) && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-[var(--surface)] border-t border-border shadow-2xl z-50 animate-slide-up">
          {/* Inline error */}
          {bottomError && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-2 text-destructive text-xs font-semibold bg-destructive-bg border-b border-destructive-border/50">
              <span className="shrink-0">️</span>
              <span>{bottomError}</span>
            </div>
          )}
          {/* Success banner */}
          {addedToCart && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-2 text-success text-xs font-semibold bg-success-bg border-b border-success-border/50">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Added to cart! <Link href={`/table/${localStorage.getItem('tableNumber') || ''}/order`} className="underline font-bold">View cart →</Link></span>
            </div>
          )}
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-raised)] border border-border flex items-center justify-center text-[var(--accent)]">
                <ShoppingCart size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {orderSummary.totalItems > 0 
                    ? `${orderSummary.totalItems} item${orderSummary.totalItems !== 1 ? 's' : ''} selected`
                    : `${dbCartSummary.totalItems} item${dbCartSummary.totalItems !== 1 ? 's' : ''} in cart`
                  }
                </p>
                <p className="text-xs text-[var(--text-secondary)] font-semibold">
                  Subtotal: <span className="text-[var(--accent)] font-mono font-bold">
                    {formatCurrency(orderSummary.totalItems > 0 ? orderSummary.totalPrice : dbCartSummary.totalPrice)}
                  </span>
                </p>
              </div>
            </div>
            
            {orderSummary.totalItems > 0 ? (
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
            ) : (
              <Link
                href={`/table/${localStorage.getItem('tableNumber') || ''}/order`}
                className="btn btn-primary btn-premium px-6 py-2.5 h-10 rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--accent)]/10 text-xs shrink-0 no-underline text-white"
              >
                <ShoppingCart size={16} />
                <span>View Cart & Checkout</span>
              </Link>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
    </div>
  );
}
