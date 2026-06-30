'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAllSessions, getSessionDetails } from '@/lib/api/table-sessions';
import { formatDate } from '@/lib/utils/formatters';
import {
  Calendar,
  IndianRupee,
  Clock,
  Users,
  Eye,
  RefreshCw,
  X,
  Loader2,
  Table2,
  Lock,
  Check,
  Trash2,
  AlertCircle
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import Link from 'next/link';
import { useAlertConfirm } from '@/lib/hooks/useAlertConfirm';


const STATUS_COLORS = {
  inactive: 'bg-gray-700 text-gray-200',
  open: 'bg-green-700 text-green-100',
  locked: 'bg-orange-700 text-orange-100',
  completed: 'bg-blue-700 text-blue-100',
  cleared: 'bg-gray-600 text-gray-200',
  cancelled: 'bg-red-700 text-red-100',
  deactivated: 'bg-red-800 text-red-100',
};

const STATUS_LABELS = {
  inactive: 'Inactive',
  open: 'Open',
  locked: 'Locked',
  completed: 'Completed',
  cleared: 'Available',
  cancelled: 'Cancelled',
  deactivated: 'Deactivated'
};

export default function SessionHistoryPage() {
  const { showAlert, showConfirm, AlertConfirmComponent } = useAlertConfirm();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState(null);

  // Filters State
  const [tableFilter, setTableFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');
  const [hideZeroAmount, setHideZeroAmount] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selected Session Details
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Fetch session history
  const fetchSessions = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);
    setPageError(null);

    try {
      const role = localStorage.getItem('dev-role') || 'admin';
      if (role === 'staff') {
        window.location.href = '/tables';
        return;
      }
      const data = await getAllSessions();
      setSessions(data || []);
    } catch (err) {
      setPageError(err.message || 'Unable to load session history.');
      console.error('Failed to load session history:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(true);
  }, [fetchSessions]);

  // Unique list of table numbers for the filter dropdown
  const tableOptions = useMemo(() => {
    const tableIds = new Set();
    const list = [{ value: 'all', label: 'All Tables' }];
    
    sessions.forEach((s) => {
      const num = s.tables?.table_number;
      if (num && !tableIds.has(num)) {
        tableIds.add(num);
        list.push({ value: String(num), label: `Table ${num}` });
      }
    });

    return list.sort((a, b) => {
      if (a.value === 'all') return -1;
      return Number(a.value) - Number(b.value);
    });
  }, [sessions]);

  // Price range options
  const priceOptions = [
    { value: 'all', label: 'All Prices' },
    { value: 'below1000', label: 'Below ₹1,000' },
    { value: '1000to5000', label: '₹1,000 - ₹5,000' },
    { value: 'above5000', label: 'Above ₹5,000' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Date select options
  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'last5days', label: 'Last 5 Days' },
    { value: 'lastweek', label: 'Last Week' },
    { value: 'lastmonth', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Reset page number on filter/pagination limits change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    tableFilter,
    priceFilter,
    dateFilter,
    customStartDate,
    customEndDate,
    customMinPrice,
    customMaxPrice,
    hideZeroAmount,
    itemsPerPage
  ]);

  // Apply filters to session data
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // 1. Table Filter
      if (tableFilter !== 'all') {
        if (String(session.tables?.table_number) !== tableFilter) {
          return false;
        }
      }

      // 2. Price Filter
      const amount = session.total_amount || 0;
      if (priceFilter === 'below1000' && amount >= 1000) return false;
      if (priceFilter === '1000to5000' && (amount < 1000 || amount > 5000)) return false;
      if (priceFilter === 'above5000' && amount <= 5000) return false;
      if (priceFilter === 'custom') {
        if (customMinPrice !== '') {
          const min = parseFloat(customMinPrice);
          if (!isNaN(min) && amount < min) return false;
        }
        if (customMaxPrice !== '') {
          const max = parseFloat(customMaxPrice);
          if (!isNaN(max) && amount > max) return false;
        }
      }

      // 2.5 Hide Fake Sessions (zero total amount)
      if (hideZeroAmount && amount === 0) {
        return false;
      }

      // 3. Date Filter
      if (dateFilter !== 'all') {
        const openedDate = new Date(session.opened_at);
        const now = new Date();

        if (dateFilter === 'last5days') {
          const limit = new Date();
          limit.setDate(now.getDate() - 5);
          if (openedDate < limit) return false;
        } else if (dateFilter === 'lastweek') {
          const limit = new Date();
          limit.setDate(now.getDate() - 7);
          if (openedDate < limit) return false;
        } else if (dateFilter === 'lastmonth') {
          const limit = new Date();
          limit.setDate(now.getDate() - 30);
          if (openedDate < limit) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (openedDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (openedDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [sessions, tableFilter, priceFilter, dateFilter, customStartDate, customEndDate, customMinPrice, customMaxPrice, hideZeroAmount]);

  // Apply pagination to filtered sessions
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;

  const pageRange = useMemo(() => {
    const range = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      if (currentPage <= 3) {
        range.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        range.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        range.push(1, '...', currentPage, '...', totalPages);
      }
    }
    return range;
  }, [currentPage, totalPages]);

  // View details handler
  const handleViewSession = async (sessionId) => {
    setIsDetailLoading(true);
    try {
      const details = await getSessionDetails(sessionId);
      setSelectedSession(details);
      setShowSessionModal(true);
    } catch (err) {
      await showAlert(err.message || 'Failed to load session details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDotClick = async () => {
    const input = prompt(`Enter page number (1 to ${totalPages}):`);
    if (input === null) return;
    const pageNum = parseInt(input, 10);
    if (!isNaN(pageNum)) {
      if (pageNum <= 0) {
        await showAlert("Minimum page number is 1");
        return;
      }
      const targetPage = Math.min(pageNum, totalPages);
      setCurrentPage(targetPage);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-border mb-6">
        {/* Left: Sub-navigation Tabs */}
        <div className="flex items-center gap-3">
          <Link
            href="/tables"
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 border-border bg-background text-[var(--text-secondary)] hover:border-border hover:text-[var(--text-primary)]"
          >
            Live Status
          </Link>
          <Link
            href="/tables/history"
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]"
          >
            Session History
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchSessions(false)}
            disabled={isRefreshing}
            className="btn btn-ghost bg-background border-border hover:bg-surface hover:text-[var(--accent)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-10 px-4 transition-all"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {pageError && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">️</span>
          <span>{pageError}</span>
        </div>
      )}

      {/* Advanced Filters Block */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-2">
          <span></span> Filter Records
        </h3>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Table Filter */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Table</label>
            <CustomSelect
              value={tableFilter}
              onChange={setTableFilter}
              options={tableOptions}
            />
          </div>

          {/* Price Range Filter */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Running Total Price</label>
            <CustomSelect
              value={priceFilter}
              onChange={setPriceFilter}
              options={priceOptions}
            />
          </div>

          {/* Date Range Select */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Timeframe</label>
            <CustomSelect
              value={dateFilter}
              onChange={setDateFilter}
              options={dateOptions}
            />
          </div>
        </div>

        {/* Custom Price Inputs (Conditionally rendered) */}
        {priceFilter === 'custom' && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 bg-background rounded-xl border border-border animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Min Price (₹)</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={customMinPrice}
                onChange={(e) => setCustomMinPrice(e.target.value)}
                className="w-full bg-surface border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Max Price (₹)</label>
              <input
                type="number"
                placeholder="e.g. 1000"
                value={customMaxPrice}
                onChange={(e) => setCustomMaxPrice(e.target.value)}
                className="w-full bg-surface border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm transition-all"
              />
            </div>
          </div>
        )}

        {/* Custom Date Inputs (Conditionally rendered) */}
        {dateFilter === 'custom' && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 bg-background rounded-xl border border-border animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-surface border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-surface border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm transition-all"
              />
            </div>
          </div>
        )}

        {/* Exclude Fake Sessions toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeroAmount}
              onChange={(e) => setHideZeroAmount(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 focus:outline-none"
            />
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">Hide Zero-Value Sessions (Fake Sessions)</span>
          </label>
        </div>
      </div>

      {/* Loading Spinner */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={36} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
            {/* Scrollable Data Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-background/40 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <th className="p-4 pl-6">Session ID</th>
                    <th className="p-4">Table</th>
                    <th className="p-4">PIN</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Opened At</th>
                    <th className="p-4">Closed At</th>
                    <th className="p-4 text-right">Devices</th>
                    <th className="p-4 text-right">Orders</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 pr-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm text-[var(--text-primary)]">
                  {paginatedSessions.length > 0 ? (
                    paginatedSessions.map((session) => {
                      const devicesCount = session.session_devices?.length || 0;
                      const ordersCount = session.orders?.length || 0;
                      return (
                        <tr key={session.id} className="hover:bg-surface-raised/30 transition-colors group">
                          <td className="p-4 pl-6 font-mono text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                            <span title={session.id}>{session.id.substring(0, 8)}...</span>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(session.id);
                                await showAlert('Session ID copied!');
                              }}
                              className="ml-2 text-[10px] bg-surface-raised/80 px-1 py-0.5 rounded border border-border hover:bg-border hover:text-[var(--accent)] transition-all cursor-pointer"
                            >
                              Copy
                            </button>
                          </td>
                          <td className="p-4 font-bold text-[var(--accent)]">
                            Table {session.tables?.table_number || 'N/A'}
                          </td>
                          <td className="p-4 font-mono font-medium">{session.pin}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${STATUS_COLORS[session.status]}`}>
                              {STATUS_LABELS[session.status]}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-[var(--text-secondary)]">
                            {formatDate(session.opened_at)}
                          </td>
                          <td className="p-4 text-xs text-[var(--text-secondary)]">
                            {session.completed_at ? formatDate(session.completed_at) : session.cleared_at ? formatDate(session.cleared_at) : '-'}
                          </td>
                          <td className="p-4 text-right font-semibold font-mono text-xs">{devicesCount}</td>
                          <td className="p-4 text-right font-semibold font-mono text-xs">{ordersCount}</td>
                          <td className="p-4 text-right font-mono font-bold text-[var(--text-primary)]">
                            ₹{(session.total_amount || 0).toFixed(2)}
                          </td>
                          <td className="p-4 pr-6 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewSession(session.id)}
                              className="btn btn-ghost hover:bg-background hover:text-[var(--accent)] rounded-lg p-2 h-9 w-9 flex items-center justify-center transition-all cursor-pointer"
                              title="View Session Details"
                            >
                              {isDetailLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-body text-[var(--text-secondary)]">
                        No matching session records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {!isLoading && filteredSessions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-4">
              {/* Left side: Items per page selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Show per page:</span>
                <div className="w-24">
                  <CustomSelect
                    value={String(itemsPerPage)}
                    onChange={(val) => setItemsPerPage(Number(val))}
                    options={[
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' }
                    ]}
                  />
                </div>
              </div>

              {/* Right side: Page numbers navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost h-9 px-3 text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {pageRange.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <button
                        key={`dot-${idx}`}
                        type="button"
                        onClick={handleDotClick}
                        className="btn btn-ghost h-9 w-9 text-xs rounded-xl hover:text-[var(--accent)]"
                        title="Jump to page..."
                      >
                        ...
                      </button>
                    );
                  }
                  return (
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
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost h-9 px-3 text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Details Modal (Reused) */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card bg-surface border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Table {selectedSession.tables?.table_number} - Session Details
              </h2>
              <button
                type="button"
                onClick={() => setShowSessionModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Session Info Grid */}
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div className="bg-background border border-border p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">PIN</p>
                <p className="font-mono font-bold text-lg text-[var(--accent)]">{selectedSession.pin}</p>
              </div>
              <div className="bg-background border border-border p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Status</p>
                <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${STATUS_COLORS[selectedSession.status]}`}>
                  {STATUS_LABELS[selectedSession.status]}
                </span>
              </div>
              <div className="bg-background border border-border p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Opened At</p>
                <p className="text-sm font-semibold">{formatDate(selectedSession.started_at)}</p>
              </div>
              <div className="bg-background border border-border p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Connected Devices</p>
                <p className="text-sm font-bold">{selectedSession.connected_devices_count}</p>
              </div>
            </div>

            {/* Orders list */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">Orders ({selectedSession.orders_count})</h3>
              {selectedSession.orders && selectedSession.orders.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedSession.orders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center bg-background border border-border p-3 rounded-xl">
                      <div>
                        <p className="text-body font-semibold">{order.item_name}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Qty: {order.quantity} | Status: <span className="font-bold text-[var(--accent)]">{order.status}</span></p>
                      </div>
                      <p className="font-bold text-[var(--accent)] font-mono">₹{order.total_price?.toFixed(2) || '0.00'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] bg-background border border-border p-4 rounded-xl text-center">No orders registered during this session.</p>
              )}
            </div>

            {/* Total */}
            <div className="bg-success-bg border border-success-border/50 text-success p-4 rounded-xl mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-success/80">Running / Total Amount</p>
                <p className="text-2xl font-mono font-bold mt-1">₹{(selectedSession.running_total || 0).toFixed(2)}</p>
              </div>
              <IndianRupee size={28} />
            </div>

            {/* Connected Devices Details */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">Session Devices</h3>
              {selectedSession.session_devices && selectedSession.session_devices.length > 0 ? (
                <div className="space-y-2">
                  {selectedSession.session_devices.map((device) => (
                    <div key={device.id} className="bg-background border border-border p-3 rounded-xl text-xs">
                      <p className="text-[var(--text-secondary)] font-mono truncate">{device.device_fingerprint}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        Joined: {formatDate(device.joined_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] bg-background border border-border p-4 rounded-xl text-center">No devices connected.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSessionModal(false)}
              className="mt-4 w-full btn btn-ghost bg-background border-border hover:bg-surface rounded-xl font-bold cursor-pointer text-xs h-10 transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
      {AlertConfirmComponent}
    </div>
  );
}
