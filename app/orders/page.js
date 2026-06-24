'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getTableStatus,
  getSessionDetails,
  lockTableSession,
  completeTableSession,
  clearTableSession,
  cancelTableSession,
} from '@/lib/api/table-sessions';
import { formatCurrency } from '@/lib/utils/formatters';
import { temporarilyUnlockSessionAction } from '@/lib/actions/orders';
import { formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';
import { 
  Users, 
  DollarSign, 
  Clock, 
  RefreshCw, 
  Lock, 
  Check, 
  Trash2, 
  X, 
  Loader2, 
  UtensilsCrossed,
  Layers,
  Zap,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS = {
  open: 'bg-green-700 text-green-100',
  occupied: 'bg-teal-700 text-teal-100',
  locked: 'bg-orange-700 text-orange-100',
  completed: 'bg-blue-700 text-blue-100',
};

const STATUS_LABELS = {
  open: 'Open',
  occupied: 'Occupied',
  locked: 'Locked',
  completed: 'Completed',
};

export default function OrdersPage() {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  const [activeTables, setActiveTables] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [unlockCountdown, setUnlockCountdown] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [devRole, setDevRole] = useState('admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDevRole(localStorage.getItem('dev-role') || 'admin');
    }
  }, []);

  const selectedSessionIdRef = useRef(selectedSessionId);
  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  // Select session from query parameter on mount/URL change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleQueryParam = () => {
        const params = new URLSearchParams(window.location.search);
        const sessionParam = params.get('session');
        if (sessionParam && activeTables.some(t => t.session_id === sessionParam)) {
          setSelectedSessionId(sessionParam);
        }
      };
      handleQueryParam();
      window.addEventListener('popstate', handleQueryParam);
      return () => window.removeEventListener('popstate', handleQueryParam);
    }
  }, [activeTables]);
  
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch active tables
  const fetchActiveTables = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setIsLoadingTables(true);
    }
    setError(null);
    try {
      const data = await getTableStatus();
      // Filter tables that have an active session (open, locked, completed)
      const online = data.filter(
        (t) => t.session_id && ['open', 'locked', 'completed'].includes(t.current_status)
      );
      setActiveTables(online);

      // If we don't have a selected session, or if the selected session is no longer active, select the first one
      if (online.length > 0) {
        if (!selectedSessionId || !online.some((t) => t.session_id === selectedSessionId)) {
          setSelectedSessionId(online[0].session_id);
        }
      } else {
        setSelectedSessionId(null);
        setSessionDetails(null);
      }
    } catch (err) {
      console.error('Failed to load active tables:', err);
      setError('Unable to load active tables.');
    } finally {
      if (initialLoad) {
        setIsLoadingTables(false);
      }
    }
  }, [selectedSessionId]);

  // Fetch details of selected session
  const fetchSessionDetails = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setIsLoadingDetails(true);
    try {
      const details = await getSessionDetails(sessionId);
      setSessionDetails(details);
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Fetch tables on mount and establish real-time subscriptions
  useEffect(() => {
    fetchActiveTables(true);

    const sessionsSubscription = supabase
      .channel('orders_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions' },
        async (payload) => {
          fetchActiveTables(false);
          if (selectedSessionIdRef.current) {
            fetchSessionDetails(selectedSessionIdRef.current);
          }
        }
      )
      .subscribe();

    const ordersSubscription = supabase
      .channel('orders_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchActiveTables(false);
          if (selectedSessionIdRef.current) {
            fetchSessionDetails(selectedSessionIdRef.current);
          }
        }
      )
      .subscribe();

    const devicesSubscription = supabase
      .channel('orders_devices_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_devices' },
        () => {
          fetchActiveTables(false);
          if (selectedSessionIdRef.current) {
            fetchSessionDetails(selectedSessionIdRef.current);
          }
        }
      )
      .subscribe();

    return () => {
      sessionsSubscription.unsubscribe();
      ordersSubscription.unsubscribe();
      devicesSubscription.unsubscribe();
    };
  }, []);

  // Fetch details whenever selectedSessionId changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId, fetchSessionDetails]);

  // Session Actions
  const handleLock = async (sessionId) => {
    setActionLoading(true);
    try {
      await lockTableSession(sessionId);
      await fetchActiveTables();
    } catch (err) {
      setError(err.message || 'Failed to end ordering.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (sessionId) => {
    setActionLoading(true);
    setConfirmAction(null);
    try {
      await completeTableSession(sessionId);
      await fetchActiveTables();
    } catch (err) {
      setError(err.message || 'Failed to complete session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async (sessionId) => {
    setActionLoading(true);
    setConfirmAction(null);
    try {
      await clearTableSession(sessionId);
      await fetchActiveTables();
    } catch (err) {
      setError(err.message || 'Failed to clear table.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (sessionId) => {
    setActionLoading(true);
    setConfirmAction(null);
    try {
      await cancelTableSession(sessionId);
      await fetchActiveTables();
    } catch (err) {
      setError(err.message || 'Failed to cancel session.');
    } finally {
      setActionLoading(false);
    }
  };
  const handleManualRefresh = async () => {
    await fetchActiveTables(true);
    if (selectedSessionId) {
      await fetchSessionDetails(selectedSessionId);
    }
  };

  useEffect(() => {
    if (sessionDetails?.unlock_until) {
      const calculateRemaining = () => {
        const diff = Math.ceil((new Date(sessionDetails.unlock_until).getTime() - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      };
      
      setUnlockCountdown(calculateRemaining());
      
      const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setUnlockCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setUnlockCountdown(0);
    }
  }, [sessionDetails]);

  const handleTemporarilyUnlock = async (sessionId) => {
    setIsUnlocking(true);
    try {
      const res = await temporarilyUnlockSessionAction(sessionId);
      if (res?.success) {
        setSessionDetails(prev => ({
          ...prev,
          unlock_until: res.data.unlock_until
        }));
        await fetchActiveTables();
      }
    } catch (err) {
      setError(err.message || 'Failed to unlock session');
    } finally {
      setIsUnlocking(false);
    }
  };

  const selectedTable = activeTables.find(t => t.session_id === selectedSessionId);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#27272a] gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Order Management
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Switch between online tables to view live sessions, track active orders, and perform billing operations.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] flex items-center justify-center gap-2 rounded-xl text-xs font-bold cursor-pointer h-10 px-4 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isLoadingTables ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-[#2a1010] border border-[#5a2020] text-[#c45a5a] text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {isLoadingTables ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : activeTables.length === 0 ? (
        <div className="card p-12 border border-[#27272a] rounded-2xl text-center max-w-md mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-[#18181b] text-[var(--text-secondary)] rounded-2xl border border-[#27272a]">
            <UtensilsCrossed size={32} />
          </div>
          <h3 className="text-md font-bold text-[var(--text-primary)]">No Active Tables</h3>
          <p className="text-xs text-[var(--text-secondary)] font-semibold">
            There are currently no active dining sessions. Go to Table Management to open a table session.
          </p>
          <div className="pt-2">
            <Link href="/tables" className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl">
              Go to Tables
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chrome-like Tabs */}
          <div className="flex border-b border-[#27272a] overflow-x-auto scrollbar-thin">
            {activeTables.map((table) => {
              const isActive = table.session_id === selectedSessionId;
              let dotColor = 'bg-gray-400';
              if (table.current_status === 'open') {
                dotColor = table.connected_devices_count > 0 ? 'bg-teal-500' : 'bg-green-500';
              }
              if (table.current_status === 'locked') dotColor = 'bg-orange-500';
              if (table.current_status === 'completed') dotColor = 'bg-blue-500';

              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedSessionId(table.session_id)}
                  className={`flex items-center gap-2.5 px-6 py-3 border-t-2 border-x text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-x-[#27272a] border-t-[var(--accent)] bg-[#18181b] text-[var(--text-primary)] shadow-sm'
                      : 'border-x-transparent border-t-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#18181b]/30'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span>Table {table.table_number}</span>
                  {table.orders_count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#27272a] text-[var(--text-secondary)]">
                      {table.orders_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab Details Content */}
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
            </div>
          ) : sessionDetails && selectedTable ? (
            <div className="grid gap-6 lg:grid-cols-3 items-start animate-fade-in">
              {/* Left/Middle Column: Info and Order Tickets */}
              <div className="lg:col-span-2 space-y-6">
                {/* Stats Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="card bg-[#18181b] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">Session PIN</p>
                    <p className="font-sans font-bold text-lg text-[var(--accent)] flex items-center gap-1.5">
                      <Zap size={16} /> {sessionDetails.pin}
                    </p>
                  </div>
                  <div className="card bg-[#18181b] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">Session Status</p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const isOccupied = sessionDetails.status === 'open' && sessionDetails.connected_devices_count > 0;
                        const statusKey = isOccupied ? 'occupied' : sessionDetails.status;
                        return (
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[statusKey]}`}>
                            {STATUS_LABELS[statusKey]}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="card bg-[#18181b] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">Devices Connected</p>
                    <p className="text-md font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
                      <Users size={16} /> {sessionDetails.connected_devices_count} device(s)
                    </p>
                  </div>
                  <div className="card bg-[#18181b] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">Session Duration</p>
                    <p className="text-md font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
                      <Clock size={16} />
                      {(() => {
                        const mins = Math.floor(sessionDetails.session_duration_ms / 60000);
                        return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min(s)`;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Orders List */}
                <div className="space-y-4">
                  <h3 className="text-md font-bold text-[var(--text-primary)]">Orders List ({sessionDetails.orders_count})</h3>
                  {sessionDetails.orders && sessionDetails.orders.length > 0 ? (
                    <div className="space-y-3">
                      {sessionDetails.orders.map((order, idx) => (
                        <div key={order.id} className="card bg-[#18181b] border border-[#27272a] p-5 rounded-2xl shadow-md">
                          <div className="flex items-center justify-between pb-3 border-b border-[#27272a]/60 mb-3">
                            <span className="text-xs font-bold text-[var(--text-primary)]">Order #{sessionDetails.orders.length - idx}</span>
                            {(() => {
                              let badgeColor = 'bg-gray-700 text-gray-200';
                              if (order.status === 'placed') badgeColor = 'bg-yellow-900/60 border border-yellow-800 text-yellow-200';
                              if (order.status === 'preparing') badgeColor = 'bg-orange-950/60 border border-orange-800 text-orange-300';
                              if (order.status === 'ready') badgeColor = 'bg-blue-950/60 border border-blue-800 text-blue-300';
                              if (order.status === 'delivered') badgeColor = 'bg-green-950/60 border border-green-800 text-green-300';
                              if (order.status === 'cancelled') badgeColor = 'bg-red-950/60 border border-red-800 text-red-300';
                              
                              return (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                  {order.status}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="space-y-3">
                            {/* Items List */}
                            <div className="space-y-2.5">
                              {order.items?.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between items-center text-sm font-semibold">
                                  <span className="text-[var(--text-primary)]">
                                    {item.name} <span className="text-zinc-500 font-bold ml-1.5">x{item.quantity}</span>
                                  </span>
                                  <span className="text-zinc-400 font-mono text-xs">{formatCurrency(item.price_at_order * item.quantity)}</span>
                                </div>
                              ))}
                            </div>

                            {order.estimated_wait_minutes && (
                              <div className="flex justify-between items-center text-sm font-semibold pt-1 border-t border-[#27272a]/20">
                                <span className="text-[var(--text-secondary)]">Est. Wait Time:</span>
                                <span className="text-[var(--accent)] font-mono">{order.estimated_wait_minutes} mins</span>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-[#27272a]/40">
                              <span className="text-[var(--text-secondary)]">Subtotal:</span>
                              <span className="text-[var(--accent)] font-mono">{formatCurrency(order.total_price)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card p-8 border border-[#27272a] rounded-2xl text-center">
                      <p className="text-xs text-[var(--text-secondary)] font-semibold">No orders placed during this session yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Bill & Session Controls */}
              <div className="space-y-6">
                {/* Total Running Bill */}
                <div className="card bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)] opacity-5 rounded-full blur-2xl pointer-events-none" />
                  <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">Total Running Bill</p>
                  <p className="text-2xl font-bold font-mono text-[var(--accent)] flex items-center gap-1">
                    <DollarSign size={20} /> {sessionDetails.running_total.toFixed(2)}
                  </p>
                </div>

                {/* Session Actions Panel */}
                <div className="card bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-lg space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Session Controls</h3>
                  <div className="flex flex-col gap-2.5">
                    {(sessionDetails.status === 'open' || sessionDetails.status === 'locked') && (
                      <>
                        {sessionDetails.status === 'locked' && (
                          <button
                            onClick={() => setConfirmAction({ action: 'complete', sessionId: sessionDetails.id })}
                            disabled={actionLoading}
                            className="btn btn-primary btn-premium w-full flex items-center justify-center gap-2 rounded-xl h-11 font-bold cursor-pointer shadow-md shadow-[var(--accent)]/5"
                          >
                            <Check size={15} />
                            <span>End Ordering & Bill</span>
                          </button>
                        )}
                        
                        {unlockCountdown > 0 ? (
                          <div className="w-full flex flex-col sm:flex-row items-center gap-2 py-2 px-4 rounded-xl bg-green-950/40 border border-green-800 text-green-300 font-semibold text-xs justify-between">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="animate-pulse" />
                              <span>Unlock active ({unlockCountdown}s remaining)</span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await lockTableSession(sessionDetails.id);
                                  setSessionDetails(prev => ({ ...prev, unlock_until: null }));
                                  await fetchActiveTables();
                                } catch (err) {
                                  setError(err.message || 'Failed to lock session');
                                }
                              }}
                              className="btn btn-ghost hover:bg-red-950/40 text-[var(--destructive)] border border-red-950/60 rounded-lg text-[10px] font-bold px-2 py-1 h-7 cursor-pointer"
                            >
                              Lock Now
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTemporarilyUnlock(sessionDetails.id)}
                            disabled={isUnlocking}
                            className="btn btn-ghost border-[#27272a] hover:bg-[#18181b] w-full flex items-center justify-center gap-2 rounded-xl h-11 font-bold cursor-pointer"
                          >
                            {isUnlocking ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                            <span>Unlock Session (30s)</span>
                          </button>
                        )}
                      </>
                    )}

                    {sessionDetails.status === 'completed' && (
                      <button
                        onClick={() => setConfirmAction({ action: 'clear', sessionId: sessionDetails.id })}
                        disabled={actionLoading}
                        className="btn btn-primary btn-premium w-full flex items-center justify-center gap-2 rounded-xl h-11 font-bold cursor-pointer shadow-md shadow-[var(--accent)]/5"
                      >
                        <Check size={15} />
                        <span>Confirm Payment & Clear</span>
                      </button>
                    )}

                    {devRole !== 'staff' && (sessionDetails.status === 'open' || sessionDetails.status === 'completed' || sessionDetails.status === 'locked') && (
                      <button
                        onClick={() => setConfirmAction({ action: 'cancel', sessionId: sessionDetails.id })}
                        disabled={actionLoading}
                        className="btn btn-ghost text-[var(--destructive)] w-full flex items-center justify-center gap-2 border border-red-950/60 bg-[#2a1010]/20 hover:bg-[#2a1010]/40 rounded-xl h-11 font-bold cursor-pointer mt-2"
                      >
                        <X size={15} />
                        <span>Emergency Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card bg-[#18181b] border border-[#27272a] w-full max-w-md p-8 rounded-2xl shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2a1f0a] border border-[#5a3a10] text-[var(--accent)] mb-4 animate-pulse">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Confirm Action</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 font-medium leading-relaxed">
              {confirmAction.action === 'complete' && 'Complete this session and generate billing statement?'}
              {confirmAction.action === 'clear' && 'Are you sure you want to clear this table? The session will be archived.'}
              {confirmAction.action === 'cancel' &&
                'WARNING: Emergency Cancel will delete/archive the session without billing. Proceed?'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] rounded-xl font-bold cursor-pointer text-xs h-10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction.action === 'complete') handleComplete(confirmAction.sessionId);
                  if (confirmAction.action === 'clear') handleClear(confirmAction.sessionId);
                  if (confirmAction.action === 'cancel') handleCancel(confirmAction.sessionId);
                }}
                disabled={actionLoading}
                className="flex-1 btn btn-primary btn-premium rounded-xl font-bold cursor-pointer text-xs h-10 animate-fade-in"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
