'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  getPendingPayments,
  getBillingHistory,
  getRevenueAnalytics,
} from '@/lib/api/billing';
import { getSessionDetails, clearTableSession } from '@/lib/api/table-sessions';
import { formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';
import { useAlertConfirm } from '@/lib/hooks/useAlertConfirm';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  IndianRupee,
  RefreshCw,
  Loader2,
  X,
  Eye,
  Check,
  Clock,
  Table2,
  TrendingUp,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Banknote,
  ShoppingBag,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  open: 'badge-open',
  locked: 'badge-locked',
  completed: 'badge-completed',
  cleared: 'badge-cleared',
  inactive: 'badge-inactive',
};

const STATUS_LABELS = {
  open: 'Open',
  locked: 'Locked',
  completed: 'Awaiting Payment',
  cleared: 'Paid & Cleared',
  inactive: 'Inactive',
};

// ─── formatters ───────────────────────────────────────────────────────────────

function fmtMoney(n) {
  return `$${(n || 0).toFixed(2)}`;
}

function fmtWait(mins) {
  if (mins <= 0) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div
      className={`stat-card rounded-2xl flex items-start gap-4 transition-all duration-200 ${
        accent ? 'border-accent-left' : ''
      }`}
    >
      <div
        className={`p-2.5 rounded-xl shrink-0 ${
          accent
            ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)]'
            : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="stat-card-label">{label}</p>
        <p className="stat-card-value text-2xl mt-1">{value}</p>
        {sub && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Bill Receipt Modal ────────────────────────────────────────────────────────

function BillModal({ session, onClose, onConfirmPayment, isProcessing }) {
  if (!session) return null;

  const subtotal = (session.orders || []).reduce(
    (sum, o) => sum + (o.total_price || 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card bg-[var(--surface)] border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-heading text-[var(--text-primary)]">
              Bill — Table {session.tables?.table_number}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
              PIN {session.pin} · Session {session.id?.substring(0, 8)}…
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer rounded-lg hover:bg-[var(--surface-raised)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Session meta */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4">
          <div className="bg-background border border-border p-3 rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">
              Opened
            </p>
            <p className="text-sm font-semibold">{formatDate(session.started_at)}</p>
          </div>
          <div className="bg-background border border-border p-3 rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">
              Bill Closed
            </p>
            <p className="text-sm font-semibold">
              {session.completed_at ? formatDate(session.completed_at) : '—'}
            </p>
          </div>
          <div className="bg-background border border-border p-3 rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">
              Orders
            </p>
            <p className="text-sm font-bold font-mono">{session.orders_count}</p>
          </div>
          <div className="bg-background border border-border p-3 rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">
              Devices
            </p>
            <p className="text-sm font-bold font-mono">
              {session.connected_devices_count}
            </p>
          </div>
        </div>

        {/* Order Line Items */}
        <div className="px-6 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Order Breakdown
          </h3>
          {session.orders && session.orders.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {session.orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-background border border-border rounded-xl p-3"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[var(--text-secondary)] font-mono">
                      Order #{order.id?.substring(0, 6)}
                    </p>
                    <span
                      className={`badge badge-${order.status}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  {/* Items */}
                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-[var(--text-primary)]">
                            {item.name}{' '}
                            <span className="text-[var(--text-secondary)] text-xs">
                              × {item.quantity}
                            </span>
                          </span>
                          <span className="font-mono text-[var(--text-primary)] font-semibold">
                            {fmtMoney(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">No items</p>
                  )}
                  {/* Order subtotal */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                    <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-bold">
                      Order Total
                    </span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {fmtMoney(order.total_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] bg-background border border-border p-4 rounded-xl text-center">
              No orders recorded.
            </p>
          )}
        </div>

        {/* Grand Total */}
        <div className="mx-6 my-4 bg-[rgba(var(--accent-rgb),0.08)] border border-[rgba(var(--accent-rgb),0.2)] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-[var(--accent)]">
              Grand Total
            </p>
            <p className="text-3xl font-mono font-bold text-[var(--accent)] mt-1">
              {fmtMoney(session.running_total)}
            </p>
          </div>
          <IndianRupee size={36} className="text-[var(--accent)] opacity-60" />
        </div>

        {/* Action row */}
        {session.status === 'completed' && onConfirmPayment && (
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={() => onConfirmPayment(session.id)}
              disabled={isProcessing}
              className="w-full btn btn-success btn-premium flex items-center justify-center gap-2 rounded-xl font-bold h-12 text-sm cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {isProcessing ? 'Processing…' : 'Confirm Payment & Clear Table'}
            </button>
          </div>
        )}

        {session.status !== 'completed' && (
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full btn btn-ghost bg-background border-border hover:bg-[var(--surface-raised)] rounded-xl font-bold h-10 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { showAlert, showConfirm, AlertConfirmComponent } = useAlertConfirm();

  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  // State
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [pendingPayments, setPendingPayments] = useState([]);
  const [historySessions, setHistorySessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // History filters
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyTable, setHistoryTable] = useState('all');
  const [historyDate, setHistoryDate] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hideZero, setHideZero] = useState(false);

  // History pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);
    setPageError(null);

    try {
      const [pending, history, analyticsData] = await Promise.all([
        getPendingPayments(),
        getBillingHistory(),
        getRevenueAnalytics(),
      ]);
      setPendingPayments(pending);
      setHistorySessions(history);
      setAnalytics(analyticsData);
    } catch (err) {
      setPageError(err.message || 'Unable to load billing data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(true);

    const sub = supabase
      .channel('billing_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => {
        fetchAll(false);
      })
      .subscribe();

    const interval = setInterval(() => fetchAll(false), 30000);

    return () => {
      sub.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchAll, supabase]);

  // ── Confirm payment ──────────────────────────────────────────────────────────

  const handleConfirmPayment = useCallback(
    async (sessionId) => {
      const ok = await showConfirm(
        'Confirm payment received and clear this table?'
      );
      if (!ok) return;
      setProcessingId(sessionId);
      try {
        await clearTableSession(sessionId);
        setShowModal(false);
        setSelectedSession(null);
        await fetchAll(false);
        await showAlert('Payment confirmed. Table has been cleared.');
      } catch (err) {
        await showAlert(err.message || 'Failed to confirm payment.');
      } finally {
        setProcessingId(null);
      }
    },
    [showConfirm, showAlert, fetchAll]
  );

  // ── View session detail ──────────────────────────────────────────────────────

  const handleViewSession = useCallback(
    async (sessionId) => {
      setIsDetailLoading(true);
      try {
        const details = await getSessionDetails(sessionId);
        setSelectedSession(details);
        setShowModal(true);
      } catch (err) {
        await showAlert(err.message || 'Failed to load session details.');
      } finally {
        setIsDetailLoading(false);
      }
    },
    [showAlert]
  );

  // ── History filter / pagination ──────────────────────────────────────────────

  const tableOptions = useMemo(() => {
    const nums = new Set();
    const list = [{ value: 'all', label: 'All Tables' }];
    historySessions.forEach((s) => {
      const n = s.tables?.table_number;
      if (n && !nums.has(n)) {
        nums.add(n);
        list.push({ value: String(n), label: `Table ${n}` });
      }
    });
    return list.sort((a, b) =>
      a.value === 'all' ? -1 : Number(a.value) - Number(b.value)
    );
  }, [historySessions]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Awaiting Payment' },
    { value: 'cleared', label: 'Paid & Cleared' },
    { value: 'open', label: 'Open' },
    { value: 'locked', label: 'Locked' },
  ];

  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'last30', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const filteredHistory = useMemo(() => {
    const now = new Date();
    return historySessions.filter((s) => {
      if (historyStatus !== 'all' && s.status !== historyStatus) return false;
      if (historyTable !== 'all' && String(s.tables?.table_number) !== historyTable)
        return false;
      if (hideZero && (s.total_amount || 0) === 0) return false;

      if (historyDate !== 'all') {
        const opened = new Date(s.opened_at);
        if (historyDate === 'today') {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          if (opened < todayStart) return false;
        } else if (historyDate === 'last7') {
          const limit = new Date(now);
          limit.setDate(now.getDate() - 7);
          if (opened < limit) return false;
        } else if (historyDate === 'last30') {
          const limit = new Date(now);
          limit.setDate(now.getDate() - 30);
          if (opened < limit) return false;
        } else if (historyDate === 'custom') {
          if (customStart) {
            const start = new Date(customStart);
            start.setHours(0, 0, 0, 0);
            if (opened < start) return false;
          }
          if (customEnd) {
            const end = new Date(customEnd);
            end.setHours(23, 59, 59, 999);
            if (opened > end) return false;
          }
        }
      }
      return true;
    });
  }, [historySessions, historyStatus, historyTable, historyDate, customStart, customEnd, hideZero]);

  useEffect(() => setCurrentPage(1), [
    historyStatus, historyTable, historyDate, customStart, customEnd, hideZero, itemsPerPage,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  const pageRange = useMemo(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, '...', totalPages];
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage, '...', totalPages];
  }, [currentPage, totalPages]);

  // ── Revenue summary totals from filtered history ─────────────────────────────
  const historyRevenue = useMemo(() => {
    return filteredHistory
      .filter((s) => s.status === 'cleared')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
  }, [filteredHistory]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <img 
            src="/images/logo.png" 
            alt="Sauté Logo" 
            className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)] shrink-0" 
          />
          <div>
            <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[var(--accent)] font-sans block leading-none mb-1">Sauté</span>
            <h1 className="text-display text-[var(--text-primary)] text-2xl font-bold leading-tight">Billing & Payments</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Process pending bills, confirm payments, and review revenue history.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchAll(false)}
          disabled={isRefreshing}
          className="btn btn-ghost bg-background border-border hover:bg-surface hover:text-[var(--accent)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-10 px-4 transition-all self-start"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Error Alert ── */}
      {pageError && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{pageError}</span>
        </div>
      )}

      {/* ── Analytics Cards ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Pending Payments"
              value={pendingPayments.length}
              sub={
                pendingPayments.length > 0
                  ? `${fmtMoney(
                      pendingPayments.reduce((s, p) => s + p.total_amount, 0)
                    )} outstanding`
                  : 'All clear'
              }
              icon={CreditCard}
              accent={pendingPayments.length > 0}
            />
            <StatCard
              label="Revenue Today"
              value={fmtMoney(analytics?.revenueToday ?? 0)}
              sub={`${analytics?.paidSessionsToday ?? 0} paid sessions`}
              icon={TrendingUp}
            />
            <StatCard
              label="Revenue This Month"
              value={fmtMoney(analytics?.revenueMonth ?? 0)}
              sub={`Avg ${fmtMoney(analytics?.avgMonth ?? 0)} / session`}
              icon={Banknote}
            />
            <StatCard
              label="All-Time Revenue"
              value={fmtMoney(analytics?.revenueAllTime ?? 0)}
              sub={`${analytics?.paidSessionsMonth ?? 0} sessions this month`}
              icon={ArrowUpRight}
            />
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-3 border-b border-border">
            {[
              { id: 'pending', label: 'Pending Payments', icon: ReceiptText },
              { id: 'history', label: 'Revenue History', icon: ShoppingBag },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer -mb-px ${
                  activeTab === id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={15} />
                {label}
                {id === 'pending' && pendingPayments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[#0F0F0F]">
                    {pendingPayments.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  TAB: Pending Payments                                            */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'pending' && (
            <div className="space-y-4 animate-fade-in">
              {pendingPayments.length === 0 ? (
                <div className="card rounded-2xl py-16 text-center border-dashed">
                  <CheckCircle2
                    size={40}
                    className="mx-auto text-[var(--success)] mb-3 opacity-60"
                  />
                  <p className="text-body text-[var(--text-secondary)]">
                    No pending payments. All tables are settled.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="card rounded-2xl border-border glow-card relative overflow-hidden"
                    >
                      {/* Decorative top accent bar */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60" />

                      {/* Card header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-heading text-[var(--text-primary)]">
                            Table {payment.table_number}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                            PIN {payment.pin}
                          </p>
                        </div>
                        <span className="badge badge-completed">
                          Awaiting Payment
                        </span>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-1">
                            Orders
                          </p>
                          <p className="text-data text-[var(--text-primary)]">
                            {payment.orders_count}
                          </p>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-1">
                            Items
                          </p>
                          <p className="text-data text-[var(--text-primary)]">
                            {payment.total_items}
                          </p>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-1">
                            Wait
                          </p>
                          <p
                            className={`text-data ${
                              payment.wait_minutes > 30
                                ? 'text-[var(--destructive)]'
                                : payment.wait_minutes > 10
                                ? 'text-[var(--warning)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {payment.wait_minutes}m
                          </p>
                        </div>
                      </div>

                      {/* Grand Total */}
                      <div className="bg-[rgba(var(--accent-rgb),0.07)] border border-[rgba(var(--accent-rgb),0.18)] rounded-xl px-4 py-3 flex items-center justify-between mb-4">
                        <p className="text-xs uppercase font-bold tracking-wider text-[var(--accent)]">
                          Total Due
                        </p>
                        <p className="font-mono font-bold text-xl text-[var(--accent)]">
                          {fmtMoney(payment.total_amount)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewSession(payment.id)}
                          disabled={isDetailLoading}
                          className="flex-1 btn btn-ghost flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer h-9"
                        >
                          {isDetailLoading ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Eye size={13} />
                          )}
                          View Bill
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmPayment(payment.id)}
                          disabled={processingId === payment.id}
                          className="flex-1 btn btn-success btn-premium flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer h-9"
                        >
                          {processingId === payment.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          {processingId === payment.id ? 'Processing…' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  TAB: Revenue History                                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'history' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filters panel */}
              <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                   Filter Records
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                      Table
                    </label>
                    <CustomSelect
                      value={historyTable}
                      onChange={setHistoryTable}
                      options={tableOptions}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                      Status
                    </label>
                    <CustomSelect
                      value={historyStatus}
                      onChange={setHistoryStatus}
                      options={statusOptions}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                      Timeframe
                    </label>
                    <CustomSelect
                      value={historyDate}
                      onChange={setHistoryDate}
                      options={dateOptions}
                    />
                  </div>
                </div>

                {historyDate === 'custom' && (
                  <div className="grid gap-4 sm:grid-cols-2 p-4 bg-background rounded-xl border border-border animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full rounded-xl h-10 px-3 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full rounded-xl h-10 px-3 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/50">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideZero}
                      onChange={(e) => setHideZero(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-background text-[var(--accent)]"
                    />
                    <span className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">
                      Hide Zero-Value Sessions
                    </span>
                  </label>
                  {filteredHistory.length > 0 && (
                    <p className="text-xs text-[var(--text-secondary)] font-mono">
                      {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}
                      {historyStatus === 'cleared' || historyStatus === 'all'
                        ? ` · ${fmtMoney(historyRevenue)} total revenue`
                        : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-background/40 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="p-4 pl-6">Session</th>
                        <th className="p-4">Table</th>
                        <th className="p-4">PIN</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Opened</th>
                        <th className="p-4">Closed</th>
                        <th className="p-4 text-right">Orders</th>
                        <th className="p-4 text-right">Total</th>
                        <th className="p-4 pr-6 text-center">Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm text-[var(--text-primary)]">
                      {paginatedHistory.length > 0 ? (
                        paginatedHistory.map((session) => (
                          <tr
                            key={session.id}
                            className="hover:bg-[var(--surface-raised)]/30 transition-colors group"
                          >
                            <td className="p-4 pl-6 font-mono text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                              <span title={session.id}>
                                {session.id.substring(0, 8)}…
                              </span>
                            </td>
                            <td className="p-4 font-bold text-[var(--accent)]">
                              Table {session.tables?.table_number ?? '—'}
                            </td>
                            <td className="p-4 font-mono font-medium">
                              {session.pin}
                            </td>
                            <td className="p-4">
                              <span className={`badge ${STATUS_COLORS[session.status] ?? ''}`}>
                                {STATUS_LABELS[session.status] ?? session.status}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-[var(--text-secondary)]">
                              {formatDate(session.opened_at)}
                            </td>
                            <td className="p-4 text-xs text-[var(--text-secondary)]">
                              {session.cleared_at
                                ? formatDate(session.cleared_at)
                                : session.completed_at
                                ? formatDate(session.completed_at)
                                : '—'}
                            </td>
                            <td className="p-4 text-right font-mono font-semibold text-xs">
                              {session.orders?.length ?? 0}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-[var(--text-primary)]">
                              {fmtMoney(session.total_amount)}
                            </td>
                            <td className="p-4 pr-6 text-center">
                              <button
                                type="button"
                                onClick={() => handleViewSession(session.id)}
                                className="btn btn-ghost hover:bg-background hover:text-[var(--accent)] rounded-lg p-2 h-9 w-9 flex items-center justify-center mx-auto transition-all cursor-pointer"
                                title="View Bill"
                              >
                                {isDetailLoading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Eye size={14} />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="p-16 text-center text-body text-[var(--text-secondary)]"
                          >
                            No matching records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {filteredHistory.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                      Per page:
                    </span>
                    <div className="w-20">
                      <CustomSelect
                        value={String(itemsPerPage)}
                        onChange={(v) => setItemsPerPage(Number(v))}
                        options={[
                          { value: '10', label: '10' },
                          { value: '15', label: '15' },
                          { value: '25', label: '25' },
                          { value: '50', label: '50' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="btn btn-ghost h-9 px-3 text-xs rounded-xl disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    {pageRange.map((p, idx) =>
                      p === '...' ? (
                        <span key={`dot-${idx}`} className="px-2 text-[var(--text-muted)] text-sm">…</span>
                      ) : (
                        <button
                          key={`page-${p}`}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`btn h-9 w-9 text-xs rounded-xl font-bold transition-all ${
                            currentPage === p
                              ? 'bg-[var(--accent)] text-[#0F0F0F]'
                              : 'btn-ghost hover:bg-surface-raised'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="btn btn-ghost h-9 px-3 text-xs rounded-xl disabled:opacity-40 flex items-center gap-1"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Bill Detail Modal ── */}
      {showModal && selectedSession && (
        <BillModal
          session={selectedSession}
          onClose={() => {
            setShowModal(false);
            setSelectedSession(null);
          }}
          onConfirmPayment={
            selectedSession.status === 'completed' ? handleConfirmPayment : null
          }
          isProcessing={processingId === selectedSession.id}
        />
      )}

      {AlertConfirmComponent}
    </div>
  );
}
