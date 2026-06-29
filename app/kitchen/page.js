'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle2, Loader2, RefreshCw, UtensilsCrossed, Eye, EyeOff, LayoutGrid, List, Trash2, ChevronDown, ChevronUp, Settings2, X } from 'lucide-react';
import { updateOrderItemStatusAction, updateOrderStatusAction, adjustOrderItemStartedAtAction, deleteOrderAction, completeOneOrderItemAction } from '@/lib/actions/kitchen';
import { getKitchenSettingsAction, setKitchenSlotsAction } from '@/lib/actions/kitchen-settings';
import { useAlertConfirm } from '@/lib/hooks/useAlertConfirm';

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
  const elapsed = Math.floor((Date.now() - new Date(item.item_started_at)) / 1000);
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
    case 'ready': return { label: 'Ready', cls: 'bg-success/10 text-success border-success/20' };
    case 'preparing': return { label: 'Preparing', cls: 'bg-warning/10 text-warning border-warning/20' };
    default: return { label: 'Pending', cls: 'bg-surface text-[var(--text-secondary)] border-border' };
  }
}

function getOrderBorderColor(status) {
  if (status === 'placed') return 'border-t-blue-500';
  if (status === 'preparing') return 'border-t-[var(--accent)]';
  if (status === 'ready') return 'border-t-green-500';
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
    const t = setTimeout(onDismiss, 2000);
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
            {item.name} is Ready!
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
function KitchenOrderCard({ order, countdowns, onItemStatusChange, onOrderDeliver, onAdjustPrepTime, viewMode, userRole, onOrderDelete, onCompleteOne }) {
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [delivering, setDelivering] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const items = order.order_items || [];
  const activeItems = items.filter(i => i.item_status !== 'ready');
  const readyItems = items.filter(i => i.item_status === 'ready');
  const allReady = items.length > 0 && activeItems.length === 0;

  async function handleItemAction(item) {
    if (item.item_status === 'ready') return;
    const next = item.item_status === 'pending' ? 'preparing' : 'ready';
    setLoadingItemId(item.id);
    await onItemStatusChange(item.id, next, order.id);
    setLoadingItemId(null);
  }

  async function handleCompleteOneItem(itemId) {
    setLoadingItemId(itemId);
    await onCompleteOne(itemId);
    setLoadingItemId(null);
  }

  async function handleDeliver() {
    setDelivering(true);
    await onOrderDeliver(order.id);
    setDelivering(false);
  }

  if (viewMode === 'list') {
    const totalCount = items.length;
    const readyCount = items.filter(i => i.item_status === 'ready').length;
    const statusBorderColor = 
      order.status === 'placed' ? 'border-l-blue-500' :
      order.status === 'preparing' ? 'border-l-[var(--accent)]' :
      order.status === 'ready' ? 'border-l-success' :
      'border-l-border';

    // Sort items: pending and preparing first, ready (done) last
    const sortedItems = [...items].sort((a, b) => {
      const aReady = a.item_status === 'ready' ? 1 : 0;
      const bReady = b.item_status === 'ready' ? 1 : 0;
      return aReady - bReady;
    });

    if (isCollapsed) {
      const activeItemsSummary = activeItems.map(i => `${i.menu_items?.name ?? 'Item'} (x${i.quantity})`).join(', ');

      return (
        <div className={`bg-surface border-2 border-border border-l-[12px] ${statusBorderColor} rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in w-full max-w-full overflow-hidden shadow-sm`}>
          {/* Column 1: Collapsed Info */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded bg-surface-raised border border-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center shrink-0"
              title="Expand Order"
            >
              <ChevronDown size={16} />
            </button>
            <div className="min-w-0">
              {order.table_sessions?.tables?.table_number ? (
                <span className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                  TABLE {order.table_sessions.tables.table_number}
                </span>
              ) : (
                <span className="text-lg font-black text-[var(--text-secondary)] tracking-tight">
                  TAKEOUT
                </span>
              )}
              <span className="text-[10px] font-mono text-[var(--text-secondary)] block uppercase truncate">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Column 2: Collapsed Items Preview */}
          <div className="flex-1 min-w-0 px-2">
            <p className="text-xs font-bold text-[var(--text-secondary)] truncate">
              {activeItemsSummary ? `ACTIVE: ${activeItemsSummary}` : 'All items ready to serve'}
            </p>
          </div>

          {/* Column 3: Collapsed Actions + Expand */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            {allReady && order.status !== 'delivered' ? (
              <button
                onClick={handleDeliver}
                disabled={delivering}
                className="py-2 px-3 bg-success hover:bg-success/90 text-white text-[10px] font-black rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                {delivering ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                DELIVER
              </button>
            ) : order.status === 'delivered' ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-success/20 text-success border border-success/40">
                DELIVERED
              </span>
            ) : (
              <span className="text-[10px] text-destructive font-black bg-destructive/10 border border-destructive/20 px-2 py-1 rounded">
                {activeItems.length} ACTIVE
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`bg-surface border-2 border-border border-l-[12px] ${statusBorderColor} rounded-xl p-6 flex flex-col md:flex-row md:items-stretch justify-between gap-6 animate-fade-in w-full max-w-full overflow-hidden shadow-md`}>
        
        {/* Column 1: Info/Meta Area */}
        <div className="flex flex-col justify-between gap-4 md:w-[160px] shrink-0 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded bg-surface-raised border border-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center shrink-0"
                title="Collapse Order"
              >
                <ChevronUp size={16} />
              </button>
              {order.table_sessions?.tables?.table_number ? (
                <div className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                  TABLE {order.table_sessions.tables.table_number}
                </div>
              ) : (
                <div className="text-lg font-black text-[var(--text-secondary)] tracking-tight">
                  TAKEOUT
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono font-bold text-[var(--text-secondary)] uppercase">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="text-sm font-extrabold text-[var(--text-primary)]">
                Placed {timeAgo(order.created_at)}
              </span>
            </div>
          </div>

          <div className="w-full mt-auto">
            {userRole === 'admin' && (
              <button
                onClick={() => onOrderDelete(order.id)}
                className="w-full py-2.5 rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-all cursor-pointer text-xs font-black flex items-center justify-center gap-1.5 shrink-0"
                title="Delete Order"
              >
                <Trash2 size={12} /> DELETE
              </button>
            )}
          </div>
        </div>

        {/* Column 2: Items List */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                ITEMS ({items.length})
              </span>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-success/20 text-success border border-success/40">
                {readyCount}/{totalCount} READY
              </span>
            </div>
            <div className="flex gap-2">
            {allReady && order.status !== 'delivered' && (
              <button
                onClick={handleDeliver}
                disabled={delivering}
                className="py-1.5 px-3 bg-success hover:bg-success/90 text-white text-[10px] font-black rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                {delivering ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                DELIVER ORDER
              </button>
            )}
            {order.status === 'delivered' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-success/20 text-success border border-success/40">
                <CheckCircle2 size={10} /> DELIVERED
              </span>
            )}
            {activeItems.length > 1 && (
              <>
                {activeItems.every(i => i.item_status === 'pending') && (
                  <button
                    onClick={async () => {
                      for (const item of activeItems) {
                        await onItemStatusChange(item.id, 'preparing', order.id);
                      }
                    }}
                    className="text-[10px] font-black bg-surface-raised border border-border hover:bg-surface px-2.5 py-1 rounded-lg text-[var(--text-primary)] cursor-pointer transition-all"
                  >
                    START ALL
                  </button>
                )}
                {activeItems.every(i => i.item_status === 'preparing') && (
                  <button
                    onClick={async () => {
                      for (const item of activeItems) {
                        await onItemStatusChange(item.id, 'ready', order.id);
                      }
                    }}
                    className="text-[10px] font-black bg-success hover:bg-success/90 text-white px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                  >
                    READY ALL
                  </button>
                )}
              </>
            )}
            </div>
          </div>
          
          <div
            className="flex flex-col gap-2 overflow-y-auto pr-4 scrollbar-thin"
            style={{ maxHeight: '248px' }}
          >
            {sortedItems.map(item => {
              const isPreparing = item.item_status === 'preparing';
              const isReady = item.item_status === 'ready';
              const secsLeft = countdowns[item.id] ?? null;
              const countdown = formatCountdown(secsLeft);
              const isOverdue = secsLeft !== null && secsLeft <= 0;
              const isLoading = loadingItemId === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`flex shrink-0 items-center justify-between gap-3 border px-4 rounded-xl w-full max-w-full overflow-hidden transition-all ${
                    isReady 
                      ? 'bg-background/30 border-border/40 opacity-60' 
                      : isPreparing 
                        ? isOverdue 
                          ? 'bg-destructive/10 border-destructive/40 border-l-[6px] border-l-destructive' 
                          : 'bg-warning/10 border-warning/30 border-l-[6px] border-l-warning' 
                        : 'bg-background/80 border-border/70'
                  }`}
                  style={{ height: '56px' }}
                >
                  
                  {/* Status Indicator & Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      isReady ? 'bg-success' : isPreparing ? (isOverdue ? 'bg-destructive animate-pulse' : 'bg-warning animate-pulse') : 'bg-[var(--text-secondary)]'
                    }`} />
                    <span className={`text-xs font-bold truncate flex-1 min-w-0 ${isReady ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                      {item.menu_items?.name ?? 'Item'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-raised border border-border text-[10px] text-[var(--text-secondary)] font-bold shrink-0">
                      x{item.quantity}
                    </span>
                    {isPreparing && countdown && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-warning/20 shrink-0 ${isOverdue ? 'text-destructive' : 'text-warning'}`}>
                        {countdown}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {!isReady && (
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
                          className="px-2.5 flex items-center justify-center rounded-lg bg-warning/20 hover:bg-warning/30 border border-warning/40 text-warning text-[10px] font-black cursor-pointer transition-all shrink-0"
                          style={{ height: '38px' }}
                        >
                          ⏱ -2m
                        </button>
                      )}
                      {isPreparing && item.quantity > 1 && (
                        <button
                          onClick={() => handleCompleteOneItem(item.id)}
                          disabled={isLoading}
                          className="px-2.5 flex items-center justify-center rounded-lg bg-success/20 hover:bg-success/30 border border-success/35 text-success text-[10px] font-black cursor-pointer transition-all shrink-0 animate-fade-in"
                          style={{ height: '38px' }}
                        >
                          {isLoading ? <Loader2 size={10} className="animate-spin" /> : 'DONE 1'}
                        </button>
                      )}
                      <button
                        onClick={() => handleItemAction(item)}
                        disabled={isLoading}
                        className={`px-3.5 flex items-center justify-center rounded-lg text-[10px] font-black cursor-pointer transition-all shrink-0 ${
                          isPreparing
                            ? 'bg-success text-white hover:bg-success/90'
                            : 'bg-surface-raised border border-border text-[var(--text-primary)] hover:bg-surface hover:border-[var(--text-primary)]'
                        }`}
                        style={{ height: '38px' }}
                      >
                        {isLoading ? <Loader2 size={10} className="animate-spin" /> : isPreparing ? 'DONE' : 'START'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>


      </div>
    );
  }

  return (
    <div className={`card bg-surface border border-border border-t-4 ${getOrderBorderColor(order.status)} rounded-2xl shadow-md flex flex-col overflow-hidden`}>

      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {order.table_sessions?.tables?.table_number && (
                <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
                  Table {order.table_sessions.tables.table_number}
                </h2>
              )}
              <span className={`badge badge-${order.status}`}>
                {order.status}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">
            Placed {timeAgo(order.created_at)}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-3">
          {userRole === 'admin' && (
            <button
              onClick={() => onOrderDelete(order.id)}
              className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 border border-destructive-border/30 transition-all cursor-pointer flex items-center justify-center"
              title="Cancel Order"
            >
              <Trash2 size={14} />
            </button>
          )}
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Est. wait</p>
            <p className="text-xl font-bold text-[var(--accent)] font-mono leading-none mt-0.5">
              {order.estimated_wait_minutes ?? 0}
              <span className="text-xs font-normal text-[var(--text-secondary)] ml-0.5">m</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Active Items — scrollable box ── */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">
            Active Items ({activeItems.length})
          </p>
          {activeItems.length > 1 && (
            <>
              {activeItems.every(i => i.item_status === 'pending') && (
                <button
                  onClick={async () => {
                    for (const item of activeItems) {
                      await onItemStatusChange(item.id, 'preparing', order.id);
                    }
                  }}
                  className="text-[10px] font-bold bg-surface-raised border border-border hover:bg-surface px-2 py-0.5 rounded text-[var(--text-primary)] cursor-pointer"
                >
                  Start All
                </button>
              )}
              {activeItems.every(i => i.item_status === 'preparing') && (
                <button
                  onClick={async () => {
                    for (const item of activeItems) {
                      await onItemStatusChange(item.id, 'ready', order.id);
                    }
                  }}
                  className="text-[10px] font-bold bg-success text-white px-2 py-0.5 rounded cursor-pointer"
                >
                  Ready All
                </button>
              )}
            </>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {activeItems.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-3 text-center italic">
              All items ready
            </p>
          ) : (
             activeItems.map(item => {
              const badge = getItemBadge(item.item_status);
              const isLoading = loadingItemId === item.id;
              const isPreparing = item.item_status === 'preparing';
              const secsLeft = countdowns[item.id] ?? null;
              const countdown = formatCountdown(secsLeft);
              const isOverdue = secsLeft !== null && secsLeft <= 0;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2.5 p-3 rounded-xl border transition-all ${isPreparing
                      ? isOverdue
                        ? 'bg-destructive-bg/20 border-destructive-border/40'
                        : 'bg-warning/10 border-warning/20'
                      : 'bg-background/60 border-border/60'
                    }`}
                >
                  {/* Header Row: Dot + Name + Qty */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${isPreparing
                        ? isOverdue ? 'bg-destructive animate-pulse' : 'bg-warning animate-pulse'
                        : 'bg-[var(--text-secondary)]'
                      }`} />
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate flex-1">
                      {item.menu_items?.name ?? 'Item'}
                    </p>
                    <span className="px-1.5 py-0.5 rounded bg-surface-raised border border-border text-[10px] text-[var(--text-secondary)] font-black shrink-0">
                      ×{item.quantity}
                    </span>
                  </div>

                  {/* Info & Action Row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/10">
                    {/* Status & Countdown */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {!isPreparing && item.menu_items?.prep_time_minutes && (
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium flex items-center gap-0.5">
                          <Clock size={9} /> {item.menu_items.prep_time_minutes}m
                        </span>
                      )}
                      {isPreparing && countdown && (
                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isOverdue ? 'text-destructive' : 'text-warning'}`}>
                          <Clock size={9} /> {countdown}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-auto">
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
                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-warning/15 hover:bg-warning/25 border border-warning/30 text-warning transition-all cursor-pointer whitespace-nowrap flex items-center gap-0.5"
                          style={{ height: '30px' }}
                        >
                          ⏱ -2m
                        </button>
                      )}
                      {isPreparing && item.quantity > 1 && (
                        <button
                          onClick={() => handleCompleteOneItem(item.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-success/20 hover:bg-success/30 border border-success/35 text-success transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          style={{ height: '30px' }}
                        >
                          {isLoading ? <Loader2 size={10} className="animate-spin" /> : 'Ready 1'}
                        </button>
                      )}
                      <button
                        onClick={() => handleItemAction(item)}
                        disabled={isLoading}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap ${isPreparing
                            ? 'bg-success text-white hover:bg-success/90'
                            : 'bg-surface-raised border border-border text-[var(--text-primary)] hover:bg-surface'
                          }`}
                        style={{ height: '30px' }}
                      >
                        {isLoading
                          ? <Loader2 size={10} className="animate-spin" />
                          : isPreparing ? 'Ready' : 'Start'
                        }
                      </button>
                    </div>
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
            <p className="text-xs font-semibold text-success text-center"> All items ready to serve</p>
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
          <p className="text-xs text-[var(--text-secondary)] text-center">Delivered </p>
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

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [readyPopup, setReadyPopup] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [activeTable, setActiveTable] = useState('all');
  const [deliveredSearch, setDeliveredSearch] = useState('');
  const [deliveredTable, setDeliveredTable] = useState('all');
  const [deliveredTimeframe, setDeliveredTimeframe] = useState('today');
  const [userRole, setUserRole] = useState('staff');
  const [sortBy, setSortBy] = useState('newest');
  const [kitchenSlots, setKitchenSlots] = useState(4);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [slotsInput, setSlotsInput] = useState('4');

  const { showAlert, showConfirm, AlertConfirmComponent } = useAlertConfirm();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setViewMode(localStorage.getItem('kitchen-view-mode') || 'grid');

      const storedRole = localStorage.getItem('dev-role');
      if (storedRole) {
        setUserRole(storedRole);
      } else {
        const getRole = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            if (profile?.role) {
              setUserRole(profile.role);
            }
          }
        };
        getRole();
      }

      // Load kitchen settings
      getKitchenSettingsAction().then(s => {
        setKitchenSlots(s.kitchenSlots);
        setSlotsInput(String(s.kitchenSlots));
      });
    }
  }, [supabase]);

  const handleToggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    localStorage.setItem('kitchen-view-mode', next);
  };

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
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

  async function handleCompleteOne(itemId) {
    await completeOneOrderItemAction(itemId);
    await fetchOrders();
  }

  async function handleCancelOrder(orderId) {
    const confirmed = await showConfirm('Are you sure you want to cancel this order?');
    if (!confirmed) return;

    try {
      await deleteOrderAction(orderId);
      await fetchOrders();
    } catch (err) {
      await showAlert('Failed to cancel order: ' + err.message);
    }
  }

  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const filteredActive = activeOrders.filter(o => {
    if (activeTable !== 'all' && String(o.table_sessions?.tables?.table_number) !== String(activeTable)) {
      return false;
    }
    return true;
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const last7Start = new Date(todayStart);
  last7Start.setDate(last7Start.getDate() - 7);

  const deliveredOrders = orders.filter(o => {
    if (o.status !== 'delivered') return false;

    const effectiveTimeframe = userRole === 'admin' ? deliveredTimeframe : 'today';
    const created = new Date(o.created_at);

    if (effectiveTimeframe === 'today') {
      return created >= todayStart;
    } else if (effectiveTimeframe === 'yesterday') {
      return created >= yesterdayStart && created < todayStart;
    } else if (effectiveTimeframe === 'last7') {
      return created >= last7Start;
    }
    return true;
  });

  const filteredDelivered = deliveredOrders.filter(o => {
    // Table filter
    if (deliveredTable !== 'all' && String(o.table_sessions?.tables?.table_number) !== String(deliveredTable)) {
      return false;
    }
    // Search filter
    if (deliveredSearch.trim() !== '') {
      const q = deliveredSearch.toLowerCase();
      const orderIdMatch = o.id.toLowerCase().includes(q);
      const itemMatch = (o.order_items || []).some(item =>
        (item.menu_items?.name || '').toLowerCase().includes(q)
      );
      return orderIdMatch || itemMatch;
    }
    return true;
  });

  const displayedRaw = filter === 'active' ? filteredActive : filteredDelivered;
  const displayed = [...displayedRaw].sort((a, b) => {
    if (sortBy === 'overdue') {
      const getOverdueScore = (order) => {
        const activeItems = (order.order_items || []).filter(i => i.item_status !== 'ready');
        if (activeItems.length === 0) return 9999999; // Completed orders go to bottom
        const remainingTimes = activeItems.map(item => {
          const prepSecs = (item.menu_items?.prep_time_minutes ?? 0) * 60;
          if (item.item_status === 'preparing') {
            const elapsed = Math.floor((Date.now() - new Date(item.item_started_at).getTime()) / 1000);
            return prepSecs - elapsed;
          }
          return prepSecs;
        });
        return Math.min(...remainingTimes);
      };

      const scoreA = getOverdueScore(a);
      const scoreB = getOverdueScore(b);

      // If one is significantly more overdue, sort by that
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      // Fallback to oldest first if scores are identical
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {AlertConfirmComponent}

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

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl h-10 px-3 text-xs bg-background border border-border text-[var(--text-primary)] outline-none cursor-pointer hover:bg-surface font-bold transition-all"
          >
            <option value="newest">New to Old</option>
            <option value="oldest">Old to New</option>
            <option value="overdue">Overdue First</option>
          </select>

          {/* Kitchen Settings — admin only */}
          {userRole === 'admin' && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(v => !v)}
                className="btn btn-ghost bg-background border-border hover:bg-surface flex items-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4"
                title="Kitchen Settings"
              >
                <Settings2 size={14} />
                <span className="hidden sm:inline">Settings</span>
              </button>

              {showSettings && (
                <div className="absolute right-0 top-12 z-50 w-72 bg-[var(--surface)] border border-border rounded-2xl shadow-2xl p-5 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Kitchen Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                        Parallel Kitchen Slots
                      </label>
                      <p className="text-[10px] text-[var(--text-secondary)] mb-3 leading-relaxed">
                        How many items your kitchen can prepare simultaneously. Used to calculate customer wait times.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={slotsInput}
                          onChange={e => setSlotsInput(e.target.value)}
                          className="w-20 h-9 rounded-xl border border-border bg-background text-center text-sm font-mono font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                        <span className="text-xs text-[var(--text-secondary)]">items at once</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {[2, 4, 6, 8].map(n => (
                          <button
                            key={n}
                            onClick={() => setSlotsInput(String(n))}
                            className={`flex-1 h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              slotsInput === String(n)
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-background border-border text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      disabled={settingsSaving}
                      onClick={async () => {
                        setSettingsSaving(true);
                        try {
                          const result = await setKitchenSlotsAction(slotsInput);
                          setKitchenSlots(result.kitchenSlots);
                          setSlotsInput(String(result.kitchenSlots));
                          setShowSettings(false);
                        } catch (e) {
                          console.error('Failed to save kitchen slots', e);
                        } finally {
                          setSettingsSaving(false);
                        }
                      }}
                      className="btn btn-primary btn-premium w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {settingsSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                      {settingsSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                  {/* Current display */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-secondary)]">Current slots</span>
                    <span className="text-xs font-bold font-mono text-[var(--accent)]">{kitchenSlots}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleToggleViewMode}
            className="btn btn-ghost bg-background border-border hover:bg-surface flex items-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4"
            title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
          >
            {viewMode === 'grid' ? <List size={14} /> : <LayoutGrid size={14} />}
            <span>{viewMode === 'grid' ? 'List' : 'Grid'}</span>
          </button>
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
          { label: 'Active Orders', value: activeOrders.length, color: 'text-[var(--text-primary)]', bg: 'bg-surface' },
          { label: 'Placed', value: orders.filter(o => o.status === 'placed').length, color: 'text-blue-400', bg: 'bg-blue-950/20 border-blue-900/40' },
          { label: 'Preparing', value: orders.filter(o => o.status === 'preparing').length, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/5 border-[var(--accent)]/20' },
          { label: 'Ready to Serve', value: orders.filter(o => o.status === 'ready').length, color: 'text-success', bg: 'bg-success/5 border-success/20' },
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
          { key: 'active', label: `Active (${activeOrders.length})` },
          { key: 'delivered', label: `Delivered (${deliveredOrders.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${filter === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Filters */}
      {filter === 'active' && (
        <div className="flex border-b border-border overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTable('all')}
            className={`flex items-center gap-2.5 px-6 py-3 border-t-2 border-x text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${activeTable === 'all'
                ? 'border-x-border border-t-[var(--accent)] bg-surface text-[var(--text-primary)] shadow-sm'
                : 'border-x-transparent border-t-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface/30'
              }`}
          >
            <span>All Tables</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-raised text-[var(--text-secondary)]">
              {activeOrders.length}
            </span>
          </button>
          {Array.from(new Set(activeOrders.map(o => o.table_sessions?.tables?.table_number).filter(Boolean)))
            .sort((a, b) => Number(a) - Number(b))
            .map(num => {
              const tableOrdersCount = activeOrders.filter(o => o.table_sessions?.tables?.table_number === num).length;
              const isActive = String(activeTable) === String(num);
              return (
                <button
                  key={num}
                  onClick={() => setActiveTable(String(num))}
                  className={`flex items-center gap-2.5 px-6 py-3 border-t-2 border-x text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${isActive
                      ? 'border-x-border border-t-[var(--accent)] bg-surface text-[var(--text-primary)] shadow-sm'
                      : 'border-x-transparent border-t-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface/30'
                    }`}
                >
                  <span>Table {num}</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-raised text-[var(--text-secondary)]">
                    {tableOrdersCount}
                  </span>
                </button>
              );
            })
          }
        </div>
      )}

      {/* Delivered Tab Filters */}
      {filter === 'delivered' && (
        <div className="flex flex-col sm:flex-row gap-3 bg-surface p-4 rounded-xl border border-border animate-fade-in">
          <input
            type="text"
            placeholder="Search by Order ID or Item name..."
            value={deliveredSearch}
            onChange={(e) => setDeliveredSearch(e.target.value)}
            className="flex-1 rounded-xl h-10 px-3 text-sm bg-background border-border text-[var(--text-primary)]"
          />
          <select
            value={deliveredTable}
            onChange={(e) => setDeliveredTable(e.target.value)}
            className="rounded-xl h-10 px-3 text-sm bg-background border-border text-[var(--text-primary)] min-w-[150px] outline-none"
          >
            <option value="all">All Tables</option>
            {Array.from(new Set(deliveredOrders.map(o => o.table_sessions?.tables?.table_number).filter(Boolean)))
              .sort((a, b) => Number(a) - Number(b))
              .map(num => (
                <option key={num} value={num}>Table {num}</option>
              ))
            }
          </select>
          {userRole === 'admin' && (
            <select
              value={deliveredTimeframe}
              onChange={(e) => setDeliveredTimeframe(e.target.value)}
              className="rounded-xl h-10 px-3 text-sm bg-background border-border text-[var(--text-primary)] min-w-[150px] outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="all">All Time</option>
            </select>
          )}
        </div>
      )}

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
        <div className="max-h-[calc(100vh-260px)] min-h-[450px] overflow-y-auto pr-2 scrollbar-thin">
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-8"
            : "flex flex-col gap-4 pb-8 w-full"
          }>
            {displayed.map(order => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                countdowns={countdowns}
                onItemStatusChange={handleItemStatusChange}
                onOrderDeliver={handleOrderDeliver}
                onAdjustPrepTime={handleAdjustPrepTime}
                viewMode={viewMode}
                userRole={userRole}
                onOrderDelete={handleCancelOrder}
                onCompleteOne={handleCompleteOne}
              />
            ))}
          </div>
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

