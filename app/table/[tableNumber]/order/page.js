'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionDetailsAction, completeTableSessionAction } from '@/lib/actions/orders';
import { getCartItemsAction, updateCartItemAction, submitSharedOrderAction } from '@/lib/actions/cart';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/formatters';
import { AdminNavBar } from '@/lib/components/AdminNavBar';
import { Clock, RefreshCw, ChefHat, CheckCircle2, ArrowLeft, ShieldAlert, Loader2, ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import PaymentScreen from '@/components/ui/PaymentScreen';

const getItemStatusMeta = (status = 'pending') => {
  switch (status) {
    case 'ready':
      return {
        label: 'Ready',
        className: 'bg-success/10 text-success border border-success/20',
      };
    case 'preparing':
      return {
        label: 'Preparing',
        className: 'bg-warning/10 text-warning border border-warning/20',
      };
    default:
      return {
        label: 'Queued',
        className: 'bg-surface border border-border text-[var(--text-secondary)]',
      };
  }
};

const getOrderProgressMeta = (order) => {
  const items = order?.items || [];
  if (!items.length) {
    return { label: 'Queued', description: 'Waiting for kitchen confirmation', className: 'bg-surface text-[var(--text-secondary)] border border-border' };
  }

  const allReady = items.every(item => item.status === 'ready');
  if (allReady) {
    return { label: 'Ready', description: 'Everything is ready to serve', className: 'bg-success/10 text-success border border-success/20' };
  }

  const somePreparing = items.some(item => item.status === 'preparing');
  if (somePreparing) {
    return { label: 'Preparing', description: 'Some items are being cooked', className: 'bg-warning/10 text-warning border border-warning/20' };
  }

  return { label: 'Queued', description: 'Your order is waiting in the kitchen', className: 'bg-surface text-[var(--text-secondary)] border border-border' };
};

export default function CustomerOrderPage() {
  useHeartbeat();
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber;
  const supabase = createClient();

  // Session state
  const [session, setSession] = useState(null);
  const [devRole, setDevRole] = useState('customer');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  // Shared cart state
  const [cartItems, setCartItems] = useState([]);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlacedMsg, setOrderPlacedMsg] = useState(null);
  const [cartError, setCartError] = useState(null);
  const cartPendingUpdates = useRef({});

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Load shared cart from DB
  const loadCart = async (sessionId) => {
    if (!sessionId) return;
    setIsCartLoading(true);
    try {
      const items = await getCartItemsAction(sessionId);
      setCartItems(items || []);
    } catch (err) {
      console.error('[CART] Failed to load cart:', err);
    } finally {
      setIsCartLoading(false);
    }
  };

  // Update a cart item quantity (optimistic + DB write)
  const updateCartItemQty = async (menuItemId, newQty) => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;

    setCartError(null);
    // Optimistic update
    setCartItems(prev => {
      if (newQty <= 0) return prev.filter(ci => ci.menu_item_id !== menuItemId);
      return prev.map(ci => ci.menu_item_id === menuItemId ? { ...ci, quantity: newQty } : ci);
    });

    cartPendingUpdates.current[menuItemId] = true;
    try {
      await updateCartItemAction(sessionId, menuItemId, newQty);
    } catch (err) {
      console.error('[CART] Failed to update item:', err);
      setCartError(err.message || 'Failed to update cart item.');
      // Revert by reloading
      await loadCart(sessionId);
    } finally {
      cartPendingUpdates.current[menuItemId] = false;
    }
  };

  // Place the order from the shared cart
  const handlePlaceOrder = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;

    if (cartItems.length === 0) {
      setCartError('Cart is empty. Add items from the menu first.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Place Order',
      message: `Place an order for ${cartItems.length} item type${cartItems.length !== 1 ? 's' : ''}? This will send the cart to the kitchen.`,
      confirmText: 'Place Order',
      confirmStyle: 'btn-primary btn-premium',
      onConfirm: async () => {
        closeConfirm();
        setIsPlacingOrder(true);
        setCartError(null);
        try {
          await submitSharedOrderAction(sessionId);
          setCartItems([]);
          setOrderPlacedMsg('Order sent to the kitchen! 🎉');
          setTimeout(() => setOrderPlacedMsg(null), 6000);
          // Reload session to reflect new order in history
          loadSession(devRole);
        } catch (err) {
          console.error('[ORDER] Failed to place order:', err);
          setCartError(err.message || 'Failed to place order. Please try again.');
        } finally {
          setIsPlacingOrder(false);
        }
      }
    });
  };

  useEffect(() => {
    const role = localStorage.getItem('dev-role') || 'admin';
    const localSessionId = localStorage.getItem('sessionId');
    setDevRole(role);
    loadSession(role);

    if (!localSessionId) return;

    // Load initial cart
    loadCart(localSessionId);

    // Real-time: orders + session status
    const ordersChannel = supabase
      .channel(`customer_orders_realtime_${localSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${localSessionId}` },
        () => loadSession(role)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'table_sessions', filter: `id=eq.${localSessionId}` },
        (payload) => {
          if (payload.new) {
            const newStatus = payload.new.status;
            if (newStatus === 'locked' || newStatus === 'completed') {
              window.location.reload();
            } else if (newStatus === 'cleared') {
              localStorage.removeItem('sessionId');
              localStorage.removeItem('tableNumber');
              localStorage.removeItem('dev-role');
              window.location.href = `/table/${tableNumber}`;
            } else {
              loadSession(role);
            }
          }
        }
      )
      .subscribe();

    // Real-time: shared cart changes
    const cartChannel = supabase
      .channel(`order_page_cart_${localSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `session_id=eq.${localSessionId}` },
        (payload) => {
          const itemId = payload.new?.menu_item_id || payload.old?.menu_item_id;
          // Skip if we have a pending local update for this item
          if (itemId && cartPendingUpdates.current[itemId]) return;

          if (payload.eventType === 'UPDATE') {
            setCartItems(prev =>
              prev.map(ci => ci.menu_item_id === payload.new.menu_item_id
                ? { ...ci, quantity: payload.new.quantity }
                : ci
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setCartItems(prev => prev.filter(ci => ci.menu_item_id !== payload.old?.menu_item_id));
          } else if (payload.eventType === 'INSERT') {
            // Reload to get full menu_items join data
            loadCart(localSessionId);
          }
        }
      )
      .subscribe();

    // Real-time: order_items changes so customers see item status updates
    const itemsChannel = supabase
      .channel(`order_items_${localSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          // Reload session to pick up item status changes
          loadSession(role);
        }
      )
      .subscribe();

    return () => {
      ordersChannel.unsubscribe();
      cartChannel.unsubscribe();
      itemsChannel.unsubscribe();
    };
  }, [tableNumber]);

  async function loadSession(currentRole) {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('id, is_active')
        .eq('table_number', tableNumber)
        .maybeSingle();

      if (tableError || !tableData) {
        setError('Table not found.');
        setLoading(false);
        return;
      }

      const { data: activeSessions, error: sessionError } = await supabase
        .from('table_sessions')
        .select('id, status')
        .eq('table_id', tableData.id)
        .in('status', ['open', 'locked', 'completed'])
        .order('opened_at', { ascending: false });

      const activeSession = activeSessions?.[0];

      if (sessionError || !activeSession) {
        setError('No active session found for this table.');
        setLoading(false);
        return;
      }

      if (currentRole === 'customer') {
        const localSessionId = localStorage.getItem('sessionId');
        if (localSessionId !== activeSession.id) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      const details = await getSessionDetailsAction(activeSession.id);
      setSession(details);
    } catch (err) {
      console.error(err);
      setError('Failed to load order details.');
    } finally {
      setLoading(false);
    }
  }

  const handleEndOrdering = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'End Ordering & Request Bill',
      message: 'Are you sure you want to end ordering? The menu will be locked and staff will be notified to collect payment.',
      confirmText: 'End & Get Bill',
      confirmStyle: 'btn-primary btn-premium',
      onConfirm: async () => {
        closeConfirm();
        setIsEndingSession(true);
        try {
          const sessionId = localStorage.getItem('sessionId');
          if (sessionId) {
            await completeTableSessionAction(sessionId);
            loadSession(devRole);
          }
        } catch (err) {
          setError(err.message || 'Failed to end ordering session.');
        } finally {
          setIsEndingSession(false);
        }
      }
    });
  };

  const handleConfirmPayment = async () => {
    setIsConfirmingPayment(true);
    try {
      // Navigate to feedback page — the feedback page will clear the session
      router.push(`/table/${tableNumber}/feedback`);
    } catch (err) {
      console.error('[PAYMENT] Navigation error:', err);
      setIsConfirmingPayment(false);
    }
  };

  // --- Render states ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)] font-medium">Loading orders…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="card max-w-md w-full bg-surface border border-destructive-border bg-destructive-bg/10 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg text-destructive text-xl">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Access Denied</h2>
          <p className="text-sm text-[var(--text-secondary)] font-semibold">
            You do not have access to Table {tableNumber}'s orders.
          </p>
          <button onClick={() => router.push('/menu')} className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl cursor-pointer">
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="card max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-xl text-center space-y-4">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Error</h2>
          <p className="text-sm text-[var(--text-secondary)] font-semibold">{error}</p>
          <Link href="/menu" className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl">Go to Menu</Link>
        </div>
      </div>
    );
  }

  // Cart derived totals
  const cartTotal = cartItems.reduce((sum, ci) => sum + (ci.menu_items?.price || 0) * ci.quantity, 0);

  // ── Full-page Payment Screen when bill has been generated ────────────────────
  if (session?.status === 'completed') {
    return (
      <PaymentScreen
        session={session}
        tableNumber={tableNumber}
        onConfirm={handleConfirmPayment}
        isConfirming={isConfirmingPayment}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
      <AdminNavBar title="Order View" subtitle={`Table ${tableNumber} active session`} />

      <main className="flex-1 p-6 md:p-10 md:overflow-y-auto space-y-8 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/menu" className="p-1.5 hover:bg-surface border border-transparent hover:border-border rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <ArrowLeft size={16} />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Table {tableNumber} Orders</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-medium uppercase tracking-wider">
              Session PIN: <span className="font-sans font-bold text-[var(--accent)]">{session.pin}</span> &bull; Status: {session.status}
            </p>
          </div>
          <button
            onClick={() => { loadSession(devRole); loadCart(localStorage.getItem('sessionId')); }}
            className="btn btn-ghost bg-background border-border hover:bg-surface flex items-center justify-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4"
          >
            <RefreshCw size={14} /><span>Refresh</span>
          </button>
        </div>

        {/* Wait Time Indicator */}
        {(() => {
          const activeOrders = session.orders?.filter(o => ['placed', 'preparing'].includes(o.status)) || [];
          if (activeOrders.length === 0) return null;
          const sortedActive = [...activeOrders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const earliestOrder = sortedActive[0];
          const totalEst = earliestOrder.estimated_wait_minutes || 15;
          const elapsedMins = Math.floor((currentTime - new Date(earliestOrder.created_at)) / 60000);
          const remainingTime = Math.max(1, totalEst - elapsedMins);
          return (
            <div className="card bg-[var(--surface-raised)] border border-[var(--accent)]/30 p-6 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] opacity-5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--accent)]/10 text-[var(--accent)] rounded-xl border border-[var(--accent)]/20 animate-pulse">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-md font-bold text-[var(--text-primary)]">Preparing Your Order</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    Estimated remaining time: <span className="text-[var(--accent)] font-bold font-mono text-sm">{remainingTime} mins</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── SHARED CART SECTION ─── */}
        {['open', 'locked'].includes(session.status) && (
          <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Shared Cart</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                ⚡ Real-time · All devices
              </span>
            </div>

            {/* Cart error */}
            {cartError && (
              <div className="flex items-center gap-2 text-destructive text-xs font-semibold p-3 bg-destructive-bg rounded-lg border border-destructive-border/50">
                <span className="shrink-0">⚠️</span><span>{cartError}</span>
              </div>
            )}

            {/* Order placed success */}
            {orderPlacedMsg && (
              <div className="flex items-center gap-2 text-success text-xs font-semibold p-3 bg-success-bg rounded-lg border border-[#205a30]/50">
                <CheckCircle2 size={14} className="shrink-0" /><span>{orderPlacedMsg}</span>
              </div>
            )}

            {/* Cart body */}
            {isCartLoading ? (
              <div className="text-center py-6">
                <Loader2 size={20} className="animate-spin inline text-[var(--accent)]" />
                <p className="text-xs text-[var(--text-secondary)] mt-2">Loading cart…</p>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-background border border-border text-[var(--text-secondary)]">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">Cart is empty</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Go to the menu, pick your items, and tap <strong>Add to Cart</strong>.</p>
                </div>
                <Link
                  href="/menu"
                  className="inline-block btn bg-background border border-border hover:bg-surface text-xs px-5 py-2 rounded-xl font-bold text-[var(--text-primary)]"
                >
                  Browse Menu →
                </Link>
              </div>
            ) : (
              <>
                {/* Cart items list */}
                <div className="space-y-3">
                  {cartItems.map(ci => (
                    <div key={ci.menu_item_id} className="flex items-center gap-3 group">
                      {/* Name + price per unit */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {ci.menu_items?.name || 'Item'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          {formatCurrency(ci.menu_items?.price || 0)} each
                        </p>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateCartItemQty(ci.menu_item_id, ci.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-background hover:bg-surface-raised border border-border flex items-center justify-center text-[var(--text-primary)] transition-all cursor-pointer"
                          title={ci.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                        >
                          {ci.quantity === 1 ? <Trash2 size={11} className="text-red-400" /> : <Minus size={11} />}
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => updateCartItemQty(ci.menu_item_id, ci.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-background hover:bg-surface-raised border border-border flex items-center justify-center text-[var(--text-primary)] transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Line total */}
                      <span className="w-20 text-right text-sm font-mono font-bold text-[var(--accent)] shrink-0">
                        {formatCurrency((ci.menu_items?.price || 0) * ci.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Divider + Cart total */}
                <div className="flex justify-between items-center pt-3 border-t border-border/60">
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    Cart Total <span className="text-[var(--text-muted)] font-normal">({cartItems.length} item type{cartItems.length !== 1 ? 's' : ''})</span>
                  </span>
                  <span className="text-xl font-mono font-bold text-[var(--accent)]">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>

                {/* Place Order button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || cartItems.length === 0}
                  className="btn btn-primary btn-premium w-full flex items-center justify-center gap-2 rounded-xl h-12 font-bold cursor-pointer mt-1 disabled:opacity-60"
                >
                  {isPlacingOrder ? (
                    <><Loader2 size={16} className="animate-spin" /><span>Placing Order…</span></>
                  ) : (
                    <><UtensilsCrossed size={16} /><span>Place Order</span></>
                  )}
                </button>
                <p className="text-center text-[10px] text-[var(--text-muted)] -mt-1">
                  Changes sync in real-time across all devices at this table
                </p>
              </>
            )}
          </div>
        )}

        {/* ─── ORDER HISTORY ─── */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Order History</h2>

          {session.orders && session.orders.length > 0 ? (
            <div className="space-y-4">
              {session.orders.map((order, idx) => {
                const progressMeta = getOrderProgressMeta(order);
                return (
                  <div key={order.id} className="card bg-surface border border-border p-6 rounded-2xl shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4 pb-3 border-b border-border/60">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Order #{session.orders.length - idx}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">ID: {order.id.substring(0, 8)}</p>
                      </div>
                      {(() => {
                        let badgeColor = 'bg-gray-700 text-gray-200';
                        if (order.status === 'placed') badgeColor = 'bg-yellow-900/60 border border-yellow-800 text-yellow-200';
                        if (order.status === 'preparing') badgeColor = 'bg-orange-950/60 border border-orange-800 text-orange-300';
                        if (order.status === 'ready') badgeColor = 'bg-blue-950/60 border border-blue-800 text-blue-300';
                        if (order.status === 'delivered') badgeColor = 'bg-green-950/60 border border-green-800 text-green-300';
                        if (order.status === 'cancelled') badgeColor = 'bg-red-950/60 border border-red-800 text-red-300';
                        return (
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                            {order.status}
                          </span>
                        );
                      })()}
                    </div>

                    <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${progressMeta.className}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      <span>{progressMeta.label}</span>
                      <span className="text-[10px] normal-case tracking-normal opacity-80">{progressMeta.description}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2.5">
                        {order.items?.map((item) => {
                          const statusMeta = getItemStatusMeta(item.status);
                          return (
                            <div key={item.id || item.name} className="flex flex-col gap-2 rounded-2xl p-3 bg-[var(--surface-raised)] border border-border">
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                                  <p className="text-[11px] text-[var(--text-secondary)]">Qty: {item.quantity} · {formatCurrency(item.price_at_order)} each</p>
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                <span>Line total</span>
                                <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    {order.status === 'preparing' && order.estimated_wait_minutes && (
                      <div className="flex justify-between items-center text-sm font-semibold pt-1 border-t border-border/20">
                        <span className="text-[var(--text-secondary)]">Est. Prep Time</span>
                        <span className="text-[var(--accent)] font-mono">{order.estimated_wait_minutes} mins</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-border/40">
                      <span className="text-[var(--text-secondary)]">Order Subtotal</span>
                      <span className="text-[var(--accent)] font-mono">{formatCurrency(order.total_price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 border border-border rounded-2xl text-center">
              <div className="inline-flex items-center justify-center p-3 bg-surface text-[var(--text-secondary)] rounded-2xl mb-4 border border-border">
                <ChefHat size={32} />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-semibold">No orders placed yet.</p>
              <p className="text-xs text-[var(--text-muted)] font-semibold mt-1">Add items to the cart above and place your first order!</p>
            </div>
          )}
        </div>

        {/* ─── SESSION SUMMARY ─── */}
        <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">Session Summary</h2>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Total running bill</span>
            <span className="text-xl font-mono font-bold text-[var(--accent)]">{formatCurrency(session.running_total)}</span>
          </div>

          {/* End Ordering & Get Bill — only for customers while session is locked */}
          {devRole === 'customer' && session.status === 'locked' && (
            <div className="pt-2 border-t border-border/40">
              <button
                onClick={handleEndOrdering}
                disabled={isEndingSession}
                className="btn w-full flex items-center justify-center gap-2 rounded-xl h-11 font-bold cursor-pointer bg-background border border-border hover:bg-surface text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                {isEndingSession ? (
                  <><Loader2 className="animate-spin" size={16} /><span>Processing…</span></>
                ) : (
                  <span>End Ordering &amp; Request Bill</span>
                )}
              </button>
              <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
                Locks the menu and notifies staff to collect payment
              </p>
            </div>
          )}

          {/* Status message when locked */}
          {session.status === 'locked' && (
            <div className="pt-3 border-t border-border/40 text-center space-y-1">
              <p className="text-xs text-[var(--text-muted)] font-medium">🔒 Session locked. No new devices can join, but you can continue ordering.</p>
            </div>
          )}
        </div>

      </main>

      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
    </div>
  );
}
