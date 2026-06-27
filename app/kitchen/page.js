'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle2, Loader2, RefreshCw, UtensilsCrossed, Eye, EyeOff } from 'lucide-react';
import { updateOrderItemStatusAction, updateOrderStatusAction, adjustOrderItemStartedAtAction } from '@/lib/actions/kitchen';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Returns seconds remaining for a preparing item. Negative = overdue.
function calcSecondsLeft(item) {
  if (item.item_status !== 'preparing' || !item.item_started_at) return null;
  const prepSecs = (item.menu_items?.prep_time_minutes ?? 0) * 60;
  const elapsed  = Math.floor((Date.now() - new Date(item.item_started_at)) / 1000);
  return prepSecs - elapsed;
}

function formatCountdown(secs) {
  if (secs === null) return null;
  if (secs <= 0) return 'Almost done!';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s left` : `${s}s left`;
}

function getItemBadge(status) {
  switch (status) {
    case 'ready':    return { label: 'Ready',     cls: 'bg-success/10 text-success border-success/20' };
    case 'preparing':return { label: 'Preparing', cls: 'bg-warning/10 text-warning border-warning/20' };
    default:         return { label: 'Pending',   cls: 'bg-surface text-[var(--text-secondary)] border-border' };
  }
}

function getOrderBorderColor(status) {
  if (status === 'placed')    return 'border-t-blue-500';
  if (status === 'preparing') return 'border-t-[var(--accent)]';
  if (status === 'ready')     return 'border-t-green-500';
  return 'border-t-border';
}

// ─── Live Countdown Hook ──────────────────────────────────────────────────────
// Ticks every second; returns a map of { itemId -> secondsLeft }
function useItemCountdowns(orders) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const map = {};
  orders.forEach(order => {
    (order.order_items || []).forEach(item => {
      if (item.item_status === 'preparing') {
        map[item.id] = calcSecondsLeft(item);
      }
    });
  });
  return map;
}

// ─── Ready Popup ──────────────────────────────────────────────────────────────
function ReadyPopup({ item, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-xs w-full">
      <div className="flex items-center gap-3 bg-[var(--surface)] border border-success/40 shadow-2xl rounded-2xl px-5 py-4">
        <div className="p-2 bg-success/10 rounded-xl border border-success/20 shrink-0">
          <CheckCircle2 size={20} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate">
            {item.name} is Ready! 🎉
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            Qty: {item.quantity} · Ready to serve
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

// ─── Order Card ───────────────────────────────────────────────────────────────
function KitchenOrderCard({ order, countdowns, onItemStatusChange, onOrderDeliver, onAdjustPrepTime }) {
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [delivering, setDelivering]       = useState(false);
  const [showReady, setShowReady]         = useState(false);

  const items       = order.order_items || [];
  const activeItems = items.filter(i => i.item_status !== 'ready');
  const readyItems  = items.filter(i => i.item_status === 'ready');
  const allReady    = items.length > 0 && activeItems.length === 0;

  async function handleItemAction(item) {
    if (item.item_status === 'ready') return;
    const next = item.item_status === 'pending' ? 'preparing' : 'ready';
    setLoadingItemId(item.id);
    await onItemStatusChange(item.id, next, order.id);
    setLoadingItemId(null);
  }

  async function handleDeliver() {
    setDelivering(true);
    await onOrderDeliver(order.id);
    setDelivering(false);
  }

  return (
    <div className={`card bg-surface border border-border border-t-4 ${getOrderBorderColor(order.status)} rounded-2xl shadow-md flex flex-col overflow-hidden`}>

      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            {order.table_sessions?.tables?.table_number && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-raised)] text-[var(--text-primary)] border border-border uppercase tracking-wider">
                🍽 Table {order.table_sessions.tables.table_number}
              </span>
            )}
            {(() => {
              let cls = 'bg-blue-900/40 border-blue-800 text-blue-300';
              if (order.status === 'preparing') cls = 'bg-orange-950/40 border-orange-800 text-orange-300';
              if (order.status === 'ready')     cls = 'bg-green-950/40 border-green-800 text-green-300';
              return (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${cls}`}>
                  {order.status}
                </span>
              );
            })()}
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            Placed {timeAgo(order.created_at)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Est. wait</p>
          <p className="text-xl font-bold text-[var(--accent)] font-mono leading-none mt-0.5">
            {order.estimated_wait_minutes ?? 0}
            <span className="text-xs font-normal text-[var(--text-secondary)] ml-0.5">m</span>
          </p>
        </div>
      </div>

      {/* ── Active Items — scrollable box ── */}
      <div className="px-5 pt-4 pb-1">
        <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-2">
          Active Items ({activeItems.length})
        </p>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {activeItems.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-3 text-center italic">
              All items ready ✓
            </p>
          ) : (
            activeItems.map(item => {
              const badge       = getItemBadge(item.item_status);
              const isLoading   = loadingItemId === item.id;
              const isPreparing = item.item_status === 'preparing';
              const secsLeft    = countdowns[item.id] ?? null;
              const countdown   = formatCountdown(secsLeft);
              const isOverdue   = secsLeft !== null && secsLeft <= 0;

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-all ${
                    isPreparing
                      ? isOverdue
                        ? 'bg-destructive-bg/20 border-destructive-border/40'
                        : 'bg-warning/5 border-warning/20'
                      : 'bg-[var(--surface-raised)] border-border'
                  }`}
                >
                  {/* Dot */}
                  <div className="shrink-0">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isPreparing
                        ? isOverdue ? 'bg-destructive animate-pulse' : 'bg-warning animate-pulse'
                        : 'bg-[var(--text-secondary)]'
                    }`} />
                  </div>

                  {/* Name + status + countdown */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {item.menu_items?.name ?? 'Item'}
                      <span className="text-[var(--text-secondary)] font-normal ml-1.5">×{item.quantity}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {/* Prep time when pending */}
                      {!isPreparing && item.menu_items?.prep_time_minutes && (
                        <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-0.5">
                          <Clock size={9} /> {item.menu_items.prep_time_minutes}m prep
                        </span>
                      )}
                      {/* Live countdown when preparing */}
                      {isPreparing && countdown && (
                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                          isOverdue ? 'text-destructive' : 'text-warning'
                        }`}>
                          <Clock size={9} /> {countdown}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPreparing && (
                      <button
                        onClick={async () => {
                          if (secsLeft !== null) {
                            const newSecsLeft = Math.max(0, secsLeft - 120);
                            if (newSecsLeft <= 0) {
                              await handleItemAction(item);
                            } else {
                              const prepSecs = (item.menu_items?.prep_time_minutes ?? 0) * 60;
                              const newElapsed = prepSecs - newSecsLeft;
                              const newStartedAt = new Date(Date.now() - newElapsed * 1000).toISOString();
                              setLoadingItemId(item.id);
                              await onAdjustPrepTime(item.id, newStartedAt);
                              setLoadingItemId(null);
                            }
                          }
                        }}
                        disabled={isLoading}
                        title="Reduce wait time by 2 minutes"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-warning/15 hover:bg-warning/25 border border-warning/30 text-warning transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                      >
                        ⏱ -2m
                      </button>
                    )}
                    <button
                      onClick={() => handleItemAction(item)}
                      disabled={isLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                        isPreparing
                          ? 'btn btn-primary bg-success/80 hover:bg-success text-white border-none'
                          : 'btn btn-ghost border border-border bg-background hover:bg-surface text-[var(--text-primary)]'
                      }`}
                    >
                      {isLoading
                        ? <Loader2 size={12} className="animate-spin" />
                        : isPreparing ? 'Mark Ready ✓' : 'Start'
                      }
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto px-5 py-4 border-t border-border">
        {allReady && order.status !== 'delivered' ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-success text-center">✅ All items ready to serve</p>
            <button
              onClick={handleDeliver}
              disabled={delivering}
              className="btn btn-primary btn-premium w-full flex items-center justify-center gap-2 rounded-xl h-10 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {delivering ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {delivering ? 'Marking…' : 'Mark as Delivered'}
            </button>
          </div>
        ) : order.status === 'delivered' ? (
          <p className="text-xs text-[var(--text-secondary)] text-center">Delivered ✓</p>
        ) : (
          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KitchenPage() {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');
  const [readyPopup, setReadyPopup] = useState(null);

  const prevItemStatuses = useRef({});
  const countdowns = useItemCountdowns(orders);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, estimated_wait_minutes, created_at,
        table_sessions:session_id (
          id,
          tables:table_id ( table_number )
        ),
        order_items (
          id, quantity, item_status, item_started_at,
          menu_items ( id, name, prep_time_minutes )
        )
      `)
      .in('status', ['placed', 'preparing', 'ready', 'delivered'])
      .order('created_at', { ascending: true });

    if (error) { console.error(error); return; }

    // Detect item → ready transitions for popup
    (data || []).forEach(order => {
      (order.order_items || []).forEach(item => {
        const prev = prevItemStatuses.current[item.id];
        if (prev && prev !== 'ready' && item.item_status === 'ready') {
          setReadyPopup({ name: item.menu_items?.name ?? 'Item', quantity: item.quantity });
        }
        prevItemStatuses.current[item.id] = item.item_status;
      });
    });

    setOrders(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchOrders();
    const ch = supabase
      .channel('kitchen-display-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },      () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe();
    return () => ch.unsubscribe();
  }, [fetchOrders]);

  async function handleItemStatusChange(itemId, newStatus, orderId) {
    await updateOrderItemStatusAction(itemId, newStatus);
    await fetchOrders();
  }

  async function handleOrderDeliver(orderId) {
    await updateOrderStatusAction(orderId, 'delivered');
    await fetchOrders();
  }

  async function handleAdjustPrepTime(itemId, newStartedAt) {
    await adjustOrderItemStartedAtAction(itemId, newStartedAt);
    await fetchOrders();
  }

  const activeOrders    = orders.filter(o => o.status !== 'delivered');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const displayed       = filter === 'active' ? activeOrders : deliveredOrders;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Kitchen Display</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Live order queue — timers update every second.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-success px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> LIVE
          </div>
          <button
            onClick={fetchOrders}
            className="btn btn-ghost bg-background border-border hover:bg-surface flex items-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Orders',  value: activeOrders.length,                                   color: 'text-[var(--text-primary)]', bg: 'bg-surface' },
          { label: 'Placed',         value: orders.filter(o=>o.status==='placed').length,           color: 'text-blue-400',              bg: 'bg-blue-950/20 border-blue-900/40' },
          { label: 'Preparing',      value: orders.filter(o=>o.status==='preparing').length,        color: 'text-[var(--accent)]',        bg: 'bg-[var(--accent)]/5 border-[var(--accent)]/20' },
          { label: 'Ready to Serve', value: orders.filter(o=>o.status==='ready').length,            color: 'text-success',               bg: 'bg-success/5 border-success/20' },
        ].map(s => (
          <div key={s.label} className={`card ${s.bg} border border-border p-4 rounded-2xl shadow-sm`}>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { key: 'active',    label: `Active (${activeOrders.length})` },
          { key: 'delivered', label: `Delivered (${deliveredOrders.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              filter === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-12 border border-border rounded-2xl text-center max-w-md mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-surface text-[var(--text-secondary)] rounded-2xl border border-border">
            <UtensilsCrossed size={32} />
          </div>
          <h3 className="text-md font-bold text-[var(--text-primary)]">
            {filter === 'active' ? 'No Active Orders' : 'No Delivered Orders'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] font-semibold">
            {filter === 'active' ? 'Orders appear here in real time.' : 'Delivered orders show here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
          {displayed.map(order => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              countdowns={countdowns}
              onItemStatusChange={handleItemStatusChange}
              onOrderDeliver={handleOrderDeliver}
              onAdjustPrepTime={handleAdjustPrepTime}
            />
          ))}
        </div>
      )}

      {/* Ready popup */}
      {readyPopup && (
        <ReadyPopup item={readyPopup} onDismiss={() => setReadyPopup(null)} />
      )}

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out forwards; }
      `}</style>
    </div>
  );
}

