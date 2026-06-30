'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionDetailsAction, completeTableSessionAction, getQueueStatusAction } from '@/lib/actions/orders';
import { getCartItemsAction, updateCartItemAction, submitSharedOrderAction } from '@/lib/actions/cart';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/formatters';
import { AdminNavBar } from '@/lib/components/AdminNavBar';
import { Clock, RefreshCw, ChefHat, CheckCircle2, ArrowLeft, ShieldAlert, Loader2, ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed, Bell } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import PaymentScreen from '@/components/ui/PaymentScreen';
import { computeLiveSecondsLeft, formatWaitLabel, formatStaticWaitLabel } from '@/lib/utils/wait-time';

// ─── Status helpers ───────────────────────────────────────────────────────────

const getItemStatusMeta = (status = 'pending') => {
  switch (status) {
    case 'ready':
      return { label: 'Ready for Pickup', className: 'bg-success/15 text-success border border-success/30' };
    case 'preparing':
      return { label: 'Preparing in Kitchen', className: 'bg-warning/15 text-warning border border-warning/30' };
    case 'pending':
      return { label: 'Order Received', className: 'bg-surface border border-border text-[var(--text-secondary)]' };
    case 'served':
      return { label: 'Served & Enjoy!', className: 'bg-success/15 text-success border border-success/30' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-destructive-bg text-destructive border border-destructive-border' };
    default:
      return { label: 'Order Received', className: 'bg-surface border border-border text-[var(--text-secondary)]' };
  }
};

const getOrderProgressMeta = (order) => {
  const items = order?.items || [];
  if (!items.length) return { label: 'Order Received', description: 'Waiting for kitchen', className: 'bg-surface text-[var(--text-secondary)] border border-border' };
  if (items.every(i => i.status === 'ready' || i.status === 'served'))    return { label: 'Ready to Serve', description: 'Everything is ready!', className: 'bg-success/10 text-success border border-success/20' };
  if (items.some(i => i.status === 'preparing')) return { label: 'Preparing', description: 'Kitchen is cooking your items', className: 'bg-warning/10 text-warning border border-warning/20' };
  return { label: 'Order Received', description: 'Your order is in the queue', className: 'bg-surface text-[var(--text-secondary)] border border-border' };
};

// Seconds remaining for a preparing item
function calcSecondsLeft(item) {
  if (!item.item_started_at || !item.prep_time_minutes) return null;
  const prepSecs = item.prep_time_minutes * 60;
  const elapsed  = Math.floor((Date.now() - new Date(item.item_started_at)) / 1000);
  return Math.max(0, prepSecs - elapsed);
}

function formatMinsLeft(secs) {
  if (secs === null) return null;
  if (secs === 0) return 'Almost ready!';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `~${m}m ${s}s` : `~${s}s`;
}

function timeAgo(dateString, referenceTime = new Date()) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const seconds = Math.floor((referenceTime - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

// ─── Customer Item Ready Toast ────────────────────────────────────────────────
function CustomerReadyToast({ item, onDismiss }) {
  useEffect(() => {
    // 1. Procedural audio chime using AudioContext
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        const now = ctx.currentTime;
        
        if (item.status === 'preparing') {
          // Double soft beep for preparing
          osc.frequency.setValueAtTime(523.25, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          
          osc.frequency.setValueAtTime(659.25, now + 0.15);
          gain.gain.setValueAtTime(0.05, now + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        } else {
          // Bright, clear chime for ready/pickup
          osc.frequency.setValueAtTime(587.33, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          
          osc.frequency.setValueAtTime(880.00, now + 0.2);
          gain.gain.setValueAtTime(0.1, now + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        }
        
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }

    // 2. Browser vibration API
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (item.status === 'preparing') {
        navigator.vibrate(100);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }

    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [onDismiss, item]);

  const isPreparing = item.status === 'preparing';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 z-[9999] w-[90vw] max-w-sm animate-slide-up">
      <div className={`flex items-center gap-3 bg-[var(--surface)] border ${
        isPreparing ? 'border-warning/50 shadow-2xl' : 'border-success/50 shadow-2xl'
      } rounded-2xl px-5 py-4`}>
        <div className={`p-2.5 ${
          isPreparing ? 'bg-warning/15 border-warning/30 text-warning' : 'bg-success/15 border-success/30 text-success'
        } rounded-xl border shrink-0 animate-bounce`}>
          <Bell size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {isPreparing ? `${item.name} is preparing! ‍` : `${item.name} is Ready! `}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {isPreparing ? 'The kitchen has started cooking your item' : 'Your item is ready to be served'}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none shrink-0 cursor-pointer"
        >×</button>
      </div>
    </div>
  );
}

// ─── Live per-item countdown (ticks every second) ────────────────────────────
function useItemTimers(session) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // Build map: orderItemId -> secondsLeft
  const map = {};
  (session?.orders || []).forEach(order => {
    (order.items || []).forEach(item => {
      if (item.status === 'preparing') {
        map[item.id] = calcSecondsLeft(item);
      }
    });
  });
  return map;
}

// ─── Live per-order wait countdown (ticks every second) ───────────────────────
// Returns { [orderId]: secondsLeft | null }
function useOrderWaitTimers(session) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const map = {};
  (session?.orders || []).forEach(order => {
    if (order.status === 'delivered' || order.status === 'cancelled') {
      map[order.id] = null;
      return;
    }
    const itemsForCalc = (order.items || []).map(i => ({
      item_status: i.status,
      item_started_at: i.item_started_at,
      prep_time_minutes: i.prep_time_minutes
    }));
    map[order.id] = computeLiveSecondsLeft(itemsForCalc, new Date());
  });
  return map;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerOrderPage() {
  useHeartbeat();
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber;
  const supabase = createClient();

  const [session, setSession]               = useState(null);
  const [devRole, setDevRole]               = useState('customer');
  const [loading, setLoading]               = useState(true);
  const [accessDenied, setAccessDenied]     = useState(false);
  const [error, setError]                   = useState(null);
  const [currentTime, setCurrentTime]       = useState(new Date());
  const [skewMs, setSkewMs]                 = useState(0);

  useEffect(() => {
    if (session?.server_time) {
      const server = new Date(session.server_time).getTime();
      const local = Date.now();
      setSkewMs(local - server);
    }
  }, [session?.server_time]);
  const [confirmDialog, setConfirmDialog]   = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const [isEndingSession, setIsEndingSession]     = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [readyToast, setReadyToast]         = useState(null); // { name }
  const [queueStatus, setQueueStatus]       = useState({ ordersAhead: 0, totalOrdersInQueue: 0 });

  const [cartItems, setCartItems]           = useState([]);
  const [isCartLoading, setIsCartLoading]   = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlacedMsg, setOrderPlacedMsg] = useState(null);
  const [cartError, setCartError]           = useState(null);
  const [editingNoteFor, setEditingNoteFor] = useState(null);
  const cartPendingUpdates = useRef({});

  // Track previous item statuses to detect → ready
  const prevItemStatuses = useRef({});
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;

  const { data: sessionData, error: sessionErr, mutate: mutateSession } = useSWR(
    sessionId ? ['session-details', sessionId] : null,
    ([, sid]) => getSessionDetailsAction(sid),
    { refreshInterval: 10000 }
  );

  const { data: qStatusData, mutate: mutateQueue } = useSWR(
    sessionId ? ['queue-status', sessionId] : null,
    ([, sid]) => getQueueStatusAction(sid),
    { refreshInterval: 10000 }
  );

  const { data: cartData, mutate: mutateCart } = useSWR(
    sessionId ? ['cart-items', sessionId] : null,
    ([, sid]) => getCartItemsAction(sid)
  );

  useEffect(() => {
    if (sessionData) setSession(sessionData);
  }, [sessionData]);

  useEffect(() => {
    if (qStatusData) setQueueStatus(qStatusData);
  }, [qStatusData]);

  useEffect(() => {
    if (cartData) setCartItems(cartData);
  }, [cartData]);

  useEffect(() => {
    if (sessionErr) setError(sessionErr.message || 'Failed to load order details.');
  }, [sessionErr]);

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  const handleDismissToast = useCallback(() => {
    setReadyToast(null);
  }, []);

  // Clock ticker (for overall wait time display and temporary unlock checking)
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Per-item countdown timers
  const itemTimers = useItemTimers(session);
  // Per-order live wait countdown
  const orderWaitTimers = useOrderWaitTimers(session);

  const loadCart = async (sessionId) => {
    if (!sessionId) return;
    setIsCartLoading(true);
    try {
      await mutateCart();
    } catch (err) {
      console.error('[CART] Failed to load cart:', err);
    } finally {
      setIsCartLoading(false);
    }
  };

  const updateCartItemQty = async (menuItemId, newQty, notes = undefined) => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;
    setCartError(null);
    setCartItems(prev => {
      if (newQty <= 0) return prev.filter(ci => ci.menu_item_id !== menuItemId);
      return prev.map(ci => ci.menu_item_id === menuItemId ? { ...ci, quantity: newQty, notes: notes !== undefined ? notes : ci.notes } : ci);
    });
    cartPendingUpdates.current[menuItemId] = true;
    try {
      const existingCartItem = cartItems.find(ci => ci.menu_item_id === menuItemId);
      const finalNotes = notes !== undefined ? notes : existingCartItem?.notes;
      await updateCartItemAction(sessionId, menuItemId, newQty, finalNotes);
      await mutateCart();
    } catch (err) {
      setCartError(err.message || 'Failed to update cart item.');
      await mutateCart();
    } finally {
      cartPendingUpdates.current[menuItemId] = false;
    }
  };

  const handlePlaceOrder = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;
    if (cartItems.length === 0) { setCartError('Cart is empty.'); return; }
    setConfirmDialog({
      isOpen: true,
      title: 'Place Order',
      message: `Send ${cartItems.length} item type${cartItems.length !== 1 ? 's' : ''} to the kitchen?`,
      confirmText: 'Place Order',
      confirmStyle: 'btn-primary btn-premium',
      onConfirm: async () => {
        closeConfirm();
        setIsPlacingOrder(true);
        setCartError(null);
        try {
          await submitSharedOrderAction(sessionId);
          setCartItems([]);
          setOrderPlacedMsg('Order sent to the kitchen! ');
          setTimeout(() => setOrderPlacedMsg(null), 6000);
          await Promise.all([mutateCart(), mutateSession(), mutateQueue()]);
          loadSession(devRole);
        } catch (err) {
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
    loadCart(localSessionId);

    const ordersChannel = supabase
      .channel(`customer_orders_realtime_${localSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${localSessionId}` },
        () => mutateSession())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'table_sessions', filter: `id=eq.${localSessionId}` },
        (payload) => {
          if (!payload.new) return;
          const s = payload.new.status;
          const currentStatus = sessionRef.current?.status;
          if (s !== currentStatus && (s === 'open' || s === 'locked' || s === 'completed')) { window.location.reload(); }
          else if (s === 'cleared') {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('tableNumber');
            localStorage.removeItem('dev-role');
            window.location.href = `/table/${tableNumber}`;
          } else { mutateSession(); }
        })
      .subscribe();

    const cartChannel = supabase
      .channel(`order_page_cart_${localSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `session_id=eq.${localSessionId}` },
        () => mutateCart())
      .subscribe();

    // order_items realtime — detect item → ready or preparing to show toast
    const itemsChannel = supabase
      .channel(`order_items_customer_${localSessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' },
        (payload) => {
          const newStatus = payload.new?.item_status;
          const prevStatus = prevItemStatuses.current[payload.new.id];

          if (newStatus === 'ready' && prevStatus && prevStatus !== 'ready') {
            let itemName = 'An item';
            const currentSession = sessionRef.current;
            if (currentSession?.orders) {
              const found = currentSession.orders.flatMap(o => o.items || []).find(i => i.id === payload.new.id);
              if (found) itemName = found.name;
            }
            setReadyToast({ name: itemName, status: 'ready' });
          } else if (newStatus === 'preparing' && prevStatus && prevStatus === 'pending') {
            let itemName = 'An item';
            const currentSession = sessionRef.current;
            if (currentSession?.orders) {
              const found = currentSession.orders.flatMap(o => o.items || []).find(i => i.id === payload.new.id);
              if (found) itemName = found.name;
            }
            setReadyToast({ name: itemName, status: 'preparing' });
          }

          if (payload.new?.id) {
            prevItemStatuses.current[payload.new.id] = newStatus;
          }
          mutateSession();
        })
      .subscribe();

    return () => {
      ordersChannel.unsubscribe();
      cartChannel.unsubscribe();
      itemsChannel.unsubscribe();
    };
  }, [tableNumber]);

  // Polling fallback to guarantee updates every 5 seconds (RLS bypass for realtime replication)
  useEffect(() => {
    const role = localStorage.getItem('dev-role') || 'admin';
    const interval = setInterval(() => {
      loadSession(role);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // After session loads, seed prevItemStatuses and update toast name if possible
  useEffect(() => {
    if (!session) return;
    session.orders?.forEach(order => {
      order.items?.forEach(item => {
        const prev = prevItemStatuses.current[item.id];
        if (prev && prev !== 'ready' && item.status === 'ready') {
          setReadyToast({ name: item.name || 'Your item' });
        }
        prevItemStatuses.current[item.id] = item.status;
      });
    });
  }, [session]);

  async function loadSession(currentRole) {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('tables').select('id, is_active').eq('table_number', tableNumber).maybeSingle();
      if (tableError || !tableData) { setError('Table not found.'); setLoading(false); return; }

      const { data: activeSessions } = await supabase
        .from('table_sessions').select('id, status').eq('table_id', tableData.id)
        .in('status', ['open', 'locked', 'completed']).order('opened_at', { ascending: false });

      const activeSession = activeSessions?.[0];
      if (!activeSession) { setError('No active session for this table.'); setLoading(false); return; }

      if (currentRole === 'customer') {
        const localSessionId = localStorage.getItem('sessionId');
        if (localSessionId !== activeSession.id) { setAccessDenied(true); setLoading(false); return; }
      }

      await Promise.all([mutateSession(), mutateQueue()]);
    } catch (err) {
      setError('Failed to load order details.');
    } finally {
      setLoading(false);
    }
  }

  const handleEndOrdering = () => {
    setConfirmDialog({
      isOpen: true, title: 'End Ordering & Request Bill',
      message: 'End ordering and request the bill?',
      confirmText: 'End & Get Bill', confirmStyle: 'btn-primary btn-premium',
      onConfirm: async () => {
        closeConfirm(); setIsEndingSession(true);
        try {
          const sessionId = localStorage.getItem('sessionId');
          if (sessionId) { await completeTableSessionAction(sessionId); loadSession(devRole); }
        } catch (err) { setError(err.message || 'Failed to end session.'); }
        finally { setIsEndingSession(false); }
      }
    });
  };

  const handleConfirmPayment = async () => {
    setIsConfirmingPayment(true);
    try { router.push(`/table/${tableNumber}/feedback`); }
    catch { setIsConfirmingPayment(false); }
  };

  // ── Loading / error states ──
  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row relative">
      <AdminNavBar title="Order View" subtitle={`Table ${tableNumber} active session`} />

      <main className="flex-1 p-6 md:p-10 md:overflow-y-auto space-y-8 max-w-5xl mx-auto w-full animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-border/60 rounded-lg"></div>
            <div className="h-4 w-40 bg-border/40 rounded-lg"></div>
          </div>
        </div>

        {/* Two-column layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Orders list skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="card bg-surface border border-border rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border/40">
                  <div className="h-5 w-24 bg-border/60 rounded-lg"></div>
                  <div className="h-5 w-32 bg-border/60 rounded-full"></div>
                </div>
                <div className="space-y-3 pt-2">
                  {[1, 2].map((j) => (
                    <div key={j} className="h-14 bg-border/40 rounded-xl"></div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border/40">
                  <div className="h-4 w-20 bg-border/40 rounded-lg"></div>
                  <div className="h-5 w-24 bg-border/60 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Session Summary skeleton */}
          <div className="space-y-6">
            <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-4">
              <div className="h-4 w-32 bg-border/60 rounded-lg"></div>
              <div className="flex justify-between items-center py-2">
                <div className="h-5 w-28 bg-border/40 rounded-lg"></div>
                <div className="h-7 w-20 bg-border/60 rounded-lg"></div>
              </div>
              <div className="h-11 bg-border/60 rounded-xl"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="card max-w-md w-full bg-surface border border-destructive-border bg-destructive-bg/10 p-8 rounded-2xl shadow-xl text-center space-y-4">
        <ShieldAlert size={32} className="mx-auto text-destructive" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Access Denied</h2>
        <p className="text-sm text-[var(--text-secondary)] font-semibold">You do not have access to Table {tableNumber}.</p>
        <button onClick={() => router.push('/menu')} className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl cursor-pointer">Go to Menu</button>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="card max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-xl text-center space-y-4">
        <span className="text-3xl">️</span>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Error</h2>
        <p className="text-sm text-[var(--text-secondary)] font-semibold">{error}</p>
        <Link href="/menu" className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl">Go to Menu</Link>
      </div>
    </div>
  );

  if (session?.status === 'completed') return (
    <PaymentScreen session={session} tableNumber={tableNumber} onConfirm={handleConfirmPayment} isConfirming={isConfirmingPayment} />
  );

  const cartTotal = cartItems.reduce((sum, ci) => sum + (ci.menu_items?.price || 0) * ci.quantity, 0);

  const isUnlocked = session?.unlock_until && new Date(session.unlock_until).getTime() > (currentTime.getTime() - skewMs);
  const statusDisplay = isUnlocked ? 'TEMPORARILY UNLOCKED' : session?.status;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row relative">
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
              PIN: <span className="font-sans font-bold text-[var(--accent)]">{session.pin}</span> · Status: <span className={isUnlocked ? 'text-success font-bold' : ''}>{statusDisplay}</span>
            </p>
          </div>
          {devRole !== 'customer' && (
            <button
              onClick={() => { loadSession(devRole); loadCart(localStorage.getItem('sessionId')); }}
              className="btn btn-ghost bg-background border-border hover:bg-surface flex items-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </div>



        {/* Order Progress Dashboard */}
        {(() => {
          const activeOrders = session.orders?.filter(o => ['placed', 'preparing', 'ready'].includes(o.status)) || [];
          const allSessionItems = activeOrders.flatMap(o => o.items || []);
          const nonCancelledItems = allSessionItems.filter(i => i.status !== 'cancelled');
          const totalItems = nonCancelledItems.length;
          if (totalItems === 0) return null;

          const completedItems = nonCancelledItems.filter(i => i.status === 'ready' || i.status === 'served').length;
          const progressPercentage = Math.round((completedItems / totalItems) * 100);

          // Calculate our items' max remaining prep time
          let ourMaxSecsRemaining = 0;
          nonCancelledItems.forEach(item => {
            if (item.status === 'ready' || item.status === 'served') return;
            if (item.status === 'preparing') {
              const left = itemTimers[item.id] ?? (item.prep_time_minutes * 60);
              if (left > ourMaxSecsRemaining) ourMaxSecsRemaining = left;
            } else if (item.status === 'pending') {
              const left = (item.prep_time_minutes || 15) * 60;
              if (left > ourMaxSecsRemaining) ourMaxSecsRemaining = left;
            }
          });

          const ourMaxMins = Math.ceil(ourMaxSecsRemaining / 60);
          
          // Total dynamic wait: our time + (orders ahead * 5 minutes)
          const hasActiveItems = nonCancelledItems.some(i => ['pending', 'preparing'].includes(i.status));
          const dynamicWaitMin = hasActiveItems 
            ? Math.max(10, ourMaxMins + (queueStatus.ordersAhead * 5))
            : 0;

          // Circular progress ring calculation
          const radius = 32;
          const strokeWidth = 6;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

          const isFullyPrepared = progressPercentage === 100;

          return (
            <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] opacity-5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Left Side: Circular SVG Loader */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    className="text-border"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    className="text-[var(--accent)] transition-all duration-1000 ease-out"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-extrabold text-[var(--text-primary)] font-mono">{progressPercentage}%</span>
                  <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Done</span>
                </div>
              </div>

              {/* Right Side: Status Details */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center justify-center sm:justify-start gap-2">
                    <Clock size={16} className={`text-[var(--accent)] ${!isFullyPrepared ? 'animate-pulse' : ''}`} />
                    {isFullyPrepared ? 'All Items Prepared! ' : 'Your Order Progress'}
                  </h2>
                  {!isFullyPrepared && (
                    <span className="inline-flex self-center items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-warning/10 text-warning border border-warning/20">
                      Preparing Food
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black font-sans tracking-tight text-[var(--text-primary)]">
                    {isFullyPrepared ? (
                      <span className="text-success">Ready to Serve!</span>
                    ) : (
                      <>
                        <span className="text-[var(--accent)] font-mono">{dynamicWaitMin}</span>
                        <span className="text-sm font-bold text-[var(--text-secondary)] ml-1">mins remaining</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-[var(--text-secondary)] font-medium">
                    {isFullyPrepared ? (
                      <p>️ All ordered items are ready. Please collect or wait for service.</p>
                    ) : (
                      <>
                        <p className="flex items-center justify-center sm:justify-start gap-1">
                          <span></span>
                          {queueStatus.ordersAhead === 0 ? (
                            <span>Your order is next in the kitchen queue!</span>
                          ) : (
                            <span>
                              <strong>{queueStatus.ordersAhead}</strong> order{queueStatus.ordersAhead !== 1 ? 's' : ''} from other tables ahead of yours.
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] italic">
                          Wait time adjusts dynamically as previous orders complete.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Shared Cart */}
        {['open', 'locked'].includes(session.status) && (
          <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Shared Cart</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                 Real-time · All devices
              </span>
            </div>
            {cartError && (
              <div className="flex items-center gap-2 text-destructive text-xs font-semibold p-3 bg-destructive-bg rounded-lg border border-destructive-border/50">
                <span>️</span><span>{cartError}</span>
              </div>
            )}
            {orderPlacedMsg && (
              <div className="flex items-center gap-2 text-success text-xs font-semibold p-3 bg-success-bg rounded-lg border border-success/30">
                <CheckCircle2 size={14} className="shrink-0" /><span>{orderPlacedMsg}</span>
              </div>
            )}
            {isCartLoading ? (
              <div className="text-center py-6">
                <Loader2 size={20} className="animate-spin inline text-[var(--accent)]" />
                <p className="text-xs text-[var(--text-secondary)] mt-2">Loading cart…</p>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <ShoppingCart size={28} className="mx-auto text-[var(--text-secondary)]" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Cart is empty</p>
                <Link href="/menu" className="inline-block btn btn-primary btn-premium text-xs px-5 py-2.5 rounded-xl font-bold">
                  Add more items
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cartItems.map(ci => (
                    <div key={ci.menu_item_id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] break-words whitespace-normal">{ci.menu_items?.name || 'Item'}</p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">{formatCurrency(ci.menu_items?.price || 0)} each</p>
                        {editingNoteFor === ci.menu_item_id ? (
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Add a note..."
                              defaultValue={ci.notes || ''}
                              onBlur={(e) => {
                                setEditingNoteFor(null);
                                if (e.target.value !== (ci.notes || '')) {
                                  updateCartItemQty(ci.menu_item_id, ci.quantity, e.target.value.substring(0, 100));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                              className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        ) : (
                          <div className="mt-0.5">
                            {ci.notes ? (
                              <button onClick={() => setEditingNoteFor(ci.menu_item_id)} className="text-[10px] text-[var(--accent)] text-left hover:underline break-words whitespace-normal inline-block cursor-pointer border-0 bg-transparent p-0">
                                Note: {ci.notes}
                              </button>
                            ) : (
                              <button onClick={() => setEditingNoteFor(ci.menu_item_id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline decoration-dotted underline-offset-2 cursor-pointer border-0 bg-transparent p-0">
                                + Add note
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0 bg-[var(--background)] border border-border rounded-xl overflow-hidden shadow-inner shrink-0">
                        <button
                          onClick={() => updateCartItemQty(ci.menu_item_id, ci.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer active:scale-90"
                        >
                          {ci.quantity === 1 ? <Trash2 size={11} className="text-red-400" /> : <Minus size={11} />}
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)] tabular-nums">{ci.quantity}</span>
                        <button
                          onClick={() => updateCartItemQty(ci.menu_item_id, ci.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer active:scale-90"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <span className="w-20 text-right text-sm font-mono font-bold text-[var(--accent)] shrink-0">
                        {formatCurrency((ci.menu_items?.price || 0) * ci.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border/60">
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    Cart Total <span className="text-[var(--text-muted)] font-normal">({cartItems.length} item{cartItems.length!==1?'s':''})</span>
                  </span>
                  <span className="text-xl font-mono font-bold text-[var(--accent)]">{formatCurrency(cartTotal)}</span>
                </div>
                <button onClick={handlePlaceOrder} disabled={isPlacingOrder || cartItems.length === 0}
                  className="btn btn-primary btn-premium w-full flex items-center justify-center gap-2 rounded-xl h-12 font-bold cursor-pointer disabled:opacity-60">
                  {isPlacingOrder
                    ? <><Loader2 size={16} className="animate-spin" /><span>Placing Order…</span></>
                    : <><UtensilsCrossed size={16} /><span>Place Order</span></>
                  }
                </button>
              </>
            )}
          </div>
        )}

        {/* Order History */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Order History</h2>

          {session.orders && session.orders.length > 0 ? (
            <div className="space-y-4">
              {session.orders.map((order, idx) => {
                const progressMeta = getOrderProgressMeta(order);
                return (
                  <div key={order.id} className="card bg-surface border border-border rounded-2xl shadow-md overflow-hidden">
                    {/* Order header */}
                    <div className="flex items-start justify-between px-5 py-4 border-b border-border/60">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Order #{session.orders.length - idx}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                          ID: {order.id.substring(0, 8)} · Placed {timeAgo(order.created_at, currentTime)}
                        </p>
                      </div>
                      {(() => {
                        let bc = 'bg-gray-700 text-gray-200';
                        let labelText = order.status;
                        if (order.status === 'placed') {
                          bc = 'bg-yellow-900/60 border border-yellow-800 text-yellow-200';
                          labelText = 'Order Received';
                        }
                        if (order.status === 'preparing') {
                          bc = 'bg-orange-950/60 border border-orange-800 text-orange-300';
                          labelText = 'Preparing in Kitchen';
                        }
                        if (order.status === 'ready') {
                          bc = 'bg-blue-950/60 border border-blue-800 text-blue-300';
                          labelText = 'Ready for Pickup';
                        }
                        if (order.status === 'delivered') {
                          bc = 'bg-green-950/60 border border-green-800 text-green-300';
                          labelText = 'Served & Enjoy!';
                        }
                        if (order.status === 'cancelled') {
                          bc = 'bg-red-950/60 border border-red-800 text-red-300';
                          labelText = 'Cancelled';
                        }
                        return <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${bc}`}>{labelText}</span>;
                      })()}
                    </div>

                    {/* Progress pill */}
                    <div className="px-5 pt-3">
                      <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${progressMeta.className}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span>{progressMeta.label}</span>
                        <span className="normal-case tracking-normal opacity-75 font-normal">{progressMeta.description}</span>
                      </div>
                    </div>

                    {/* ── Items — scrollable box ── */}
                    <div className="px-5 pt-3 pb-1">
                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {(() => {
                          const grouped = [];
                          (order.items || []).forEach(item => {
                            const existing = grouped.find(g => g.name === item.name && g.status === item.status && g.notes === item.notes);
                            if (existing) {
                              existing.quantity += item.quantity;
                              existing.subtotal += item.subtotal;
                            } else {
                              grouped.push({ ...item });
                            }
                          });
                          return grouped.map((item) => {
                            const statusMeta  = getItemStatusMeta(item.status);
                            const isReady     = item.status === 'ready';
                            const isPreparing = item.status === 'preparing';
                            const secsLeft    = itemTimers[item.id] ?? null;
                            const timeLabel   = isPreparing ? formatMinsLeft(secsLeft) : null;

                            return (
                              <div
                                key={item.id || item.name}
                                className={`rounded-xl border p-3 transition-all ${
                                  isReady
                                    ? 'bg-success/5 border-success/20 opacity-80'
                                    : isPreparing
                                    ? 'bg-warning/5 border-warning/20'
                                    : 'bg-[var(--surface-raised)] border-border'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {/* Status icon */}
                                    {isReady ? (
                                      <CheckCircle2 size={14} className="text-success shrink-0" />
                                    ) : (
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${isPreparing ? 'bg-warning animate-pulse' : 'bg-[var(--text-secondary)]'}`} />
                                    )}
                                    <div className="min-w-0">
                                      <p className={`text-sm font-semibold break-words whitespace-normal ${isReady ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                                        {item.name}
                                        <span className="text-[var(--text-secondary)] font-normal ml-1.5">×{item.quantity}</span>
                                      </p>
                                      {item.notes && (
                                        <p className="text-[10px] italic text-[var(--text-secondary)] mt-0.5 break-words whitespace-normal">
                                          Note: {item.notes}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                        {formatCurrency(item.price_at_order)} each
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
                                      {statusMeta.label}
                                    </span>
                                    {/* Live countdown or prep time for customer */}
                                    {item.status === 'pending' && item.prep_time_minutes && (
                                      <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1 flex items-center justify-end gap-0.5">
                                        <Clock size={9} /> Est: {item.prep_time_minutes}m
                                      </p>
                                    )}
                                    {isPreparing && timeLabel && (
                                      <p className="text-[10px] text-warning font-mono mt-1 flex items-center justify-end gap-0.5">
                                        <Clock size={9} /> {timeLabel}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-border/30 text-[10px] text-[var(--text-secondary)]">
                                  <span>Line total</span>
                                  <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Order footer */}
                    <div className="px-5 py-4 space-y-1">
                      {/* Live wait countdown */}
                      {(() => {
                        const isActive = order.status === 'placed' || order.status === 'preparing';
                        if (!isActive) return null;

                        const secsLeft = orderWaitTimers[order.id];
                        const isPreparing = order.status === 'preparing';

                        // Live label from real-time item data (when any item has started)
                        const liveLabel = isPreparing
                          ? formatWaitLabel(secsLeft, order.status)
                          : null;

                        // Fallback to stored initial estimate (when order is still 'placed')
                        const staticLabel = !isPreparing
                          ? formatStaticWaitLabel(order.estimated_wait_minutes)
                          : null;

                        const label = liveLabel || staticLabel;
                        if (!label) return null;

                        const isOverdue = isPreparing && secsLeft !== null && secsLeft <= 0;
                        const isPulsing = isPreparing && secsLeft !== null && secsLeft > 0;

                        return (
                          <div className={`flex justify-between items-center text-xs font-semibold rounded-xl px-3 py-2 ${
                            isOverdue
                              ? 'bg-success/10 border border-success/30'
                              : isPulsing
                              ? 'bg-warning/8 border border-warning/20'
                              : 'bg-surface border border-border'
                          }`}>
                            <span className={`flex items-center gap-1.5 ${
                              isOverdue ? 'text-success' : isPulsing ? 'text-warning' : 'text-[var(--text-secondary)]'
                            }`}>
                              <Clock size={11} className={isPulsing ? 'animate-pulse' : ''} />
                              {isPreparing ? 'Estimated time left' : 'Estimated wait'}
                            </span>
                            <span className={`font-mono font-bold ${
                              isOverdue ? 'text-success' : isPulsing ? 'text-warning' : 'text-[var(--accent)]'
                            }`}>
                              {label}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-border/40">
                        <span className="text-[var(--text-secondary)]">Order Subtotal</span>
                        <span className="text-[var(--accent)] font-mono">{formatCurrency(order.total_price)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-12 border border-border rounded-2xl text-center">
              <ChefHat size={32} className="mx-auto text-[var(--text-secondary)] mb-4" />
              <p className="text-sm text-[var(--text-secondary)] font-semibold">No orders placed yet.</p>
            </div>
          )}
        </div>

        {/* Session Summary */}
        <div className="card bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">Session Summary</h2>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Total running bill</span>
            <span className="text-xl font-mono font-bold text-[var(--accent)]">{formatCurrency(session.running_total)}</span>
          </div>
          {devRole === 'customer' && session.status === 'locked' && (() => {
            const hasUnprocessed = session.orders?.some(o => ['placed', 'preparing', 'ready'].includes(o.status));
            return (
              <div className="pt-2 border-t border-border/40">
                <button
                  onClick={handleEndOrdering}
                  disabled={isEndingSession || hasUnprocessed}
                  className="btn w-full flex items-center justify-center gap-2 rounded-xl h-11 font-bold cursor-pointer bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEndingSession ? (
                    <><Loader2 className="animate-spin" size={16} /><span>Processing…</span></>
                  ) : (
                    <span>End Ordering &amp; Request Bill</span>
                  )}
                </button>
                {hasUnprocessed ? (
                  <p className="text-center text-[10px] text-orange-400 mt-2 font-semibold animate-pulse">
                    ️ Please wait for all ordered items to be served before requesting the bill.
                  </p>
                ) : (
                  <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
                    Locks the menu and notifies staff to collect payment
                  </p>
                )}
              </div>
            );
          })()}
          {session.status === 'locked' && (
            <div className="pt-3 border-t border-border/40 text-center">
              <p className="text-xs text-[var(--text-muted)] font-medium"> Session locked. You can still add more items.</p>
            </div>
          )}
        </div>

      </main>

      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />

      {/* Customer ready toast — centered bottom */}
      {readyToast && (
        <CustomerReadyToast item={readyToast} onDismiss={handleDismissToast} />
      )}

      <style>{`
        @keyframes slide-up-mobile {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slide-up-desktop {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up-mobile 0.3s ease-out forwards; }
        @media (min-width: 768px) {
          .animate-slide-up { animation: slide-up-desktop 0.3s ease-out forwards; }
        }
      `}</style>
    </div>
  );
}
