/**
 * /app/dashboard/page.js
 * 
 * Admin dashboard — main metrics page
 * Displays 6 KPI stat cards with realtime updates
 * 
 * DESIGN COMPLIANCE (globals.md):
 * - Dark theme throughout
 * - ONE accent element per screen: active-orders card gets `.border-accent-left` (amber 2px left border)
 * - Rest of cards: neutral background, no accent
 * - All numeric values in `.text-data` (JetBrains Mono)
 * - Stat labels in `.text-small` UPPERCASE
 * - Stat values in `.stat-card-value` (32px, monospace)
 * - Card grid: 2 columns on desktop, 1 on mobile (Tailwind grid-cols-1 md:grid-cols-2)
 * 
 * REALTIME UPDATES:
 * useDashboard hook subscribes to Supabase channels
 * When orders or sessions change, metrics update instantly
 * No polling needed; <100ms latency
 * 
 * WAIT TIME COLORS:
 * Applied to avgWaitTime value:
 * - < 30 min: .wait-normal (text-primary)
 * - 30-45 min: .wait-amber (accent color)
 * - > 45 min: .wait-danger (destructive color)
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatCurrency, formatWaitTime, getWaitTimeClass, formatCount } from '@/lib/utils/formatters';
import { TrendingUp, Clock, IndianRupee, TableProperties, ShoppingCart, Users, Loader2, RefreshCw, Star, Search, X } from 'lucide-react';
import { getRatingsList } from '@/lib/api/dashboard';
import Link from 'next/link';
import { LogoIcon } from '@/lib/components/AdminNavBar';

export default function DashboardPage() {
  const { metrics, isLoading, error, refresh } = useDashboard();

  // Ratings Popup Modal States
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [selectedStars, setSelectedStars] = useState('all');
  const [selectedTable, setSelectedTable] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeComment, setActiveComment] = useState(null);

  // Fetch ratings list on modal open
  useEffect(() => {
    if (!showRatingsModal) return;

    const fetchRatings = async () => {
      setRatingsLoading(true);
      try {
        const list = await getRatingsList();
        setRatings(list || []);
      } catch (err) {
        console.error('Failed to load ratings list:', err);
      } finally {
        setRatingsLoading(false);
      }
    };

    fetchRatings();
  }, [showRatingsModal]);

  // Compute unique tables list for filtering
  const uniqueTables = useMemo(() => {
    const tablesSet = new Set();
    ratings.forEach(rating => {
      const num = rating.table_sessions?.tables?.table_number;
      if (num !== undefined && num !== null) {
        tablesSet.add(num);
      }
    });
    return Array.from(tablesSet).sort((a, b) => Number(a) - Number(b));
  }, [ratings]);

  // Compute filtered ratings
  const filteredRatings = useMemo(() => {
    return ratings.filter((rating) => {
      // 1. Star Rating filter
      if (selectedStars !== 'all' && rating.rating !== parseInt(selectedStars)) {
        return false;
      }
      
      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const tableStr = `table ${rating.table_sessions?.tables?.table_number || ''}`.toLowerCase();
        const commentStr = (rating.feedback_comment || '').toLowerCase();
        if (!tableStr.includes(query) && !commentStr.includes(query)) {
          return false;
        }
      }

      // 3. Table filter
      if (selectedTable !== 'all') {
        const tableNum = rating.table_sessions?.tables?.table_number;
        if (String(tableNum) !== String(selectedTable)) {
          return false;
        }
      }

      // 4. Date range filter
      if (selectedDateRange !== 'all') {
        const createdDate = new Date(rating.created_at);
        const now = new Date();
        
        if (selectedDateRange === 'today') {
          if (createdDate.toDateString() !== now.toDateString()) return false;
        } else if (selectedDateRange === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (createdDate.toDateString() !== yesterday.toDateString()) return false;
        } else if (selectedDateRange === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (createdDate < sevenDaysAgo) return false;
        } else if (selectedDateRange === 'month') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (createdDate < thirtyDaysAgo) return false;
        }
      }

      // 5. Price range filter
      if (selectedPriceRange !== 'all') {
        const amount = parseFloat(rating.table_sessions?.total_amount || 0);
        if (selectedPriceRange === 'under500') {
          if (amount >= 500) return false;
        } else if (selectedPriceRange === '500to1500') {
          if (amount < 500 || amount > 1500) return false;
        } else if (selectedPriceRange === 'over1500') {
          if (amount <= 1500) return false;
        }
      }

      return true;
    });
  }, [ratings, selectedStars, searchQuery, selectedTable, selectedDateRange, selectedPriceRange]);

  // Compute star distribution breakdown from ALL ratings
  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(r => {
      if (counts[r.rating] !== undefined) {
        counts[r.rating]++;
      }
    });
    return counts;
  }, [ratings]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3.5">
          <LogoIcon size={44} className="shrink-0" />
          <div>
            <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Real-time metrics for restaurant operations. Metrics update automatically.
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="btn btn-ghost bg-background border-border hover:bg-surface hover:text-[var(--accent)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs self-start sm:self-auto h-9"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader2 size={36} className="animate-spin text-[var(--accent)] inline-block" />
            <p className="mt-4 text-sm text-[var(--text-secondary)] font-medium">Loading metrics…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Active Orders (HIGHLIGHTED - one accent element) */}
            <Link href="/orders" className="stat-card bg-surface border border-border border-l-4 border-l-[var(--accent)] p-6 rounded-2xl shadow-lg hover:border-l-[var(--accent)] transition-all duration-300 relative overflow-hidden group block hover:no-underline cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)] opacity-5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Active Orders</p>
                  <p className="text-4xl font-extrabold font-mono text-[var(--accent)] mt-2">{metrics.activeOrders}</p>
                </div>
                <TrendingUp size={24} className="text-[var(--accent)] opacity-50 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                Orders in progress (placed, preparing, ready)
              </p>
            </Link>

            {/* Card 2: Average Wait Time */}
            <div className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Avg Wait Time</p>
                  <p className={`text-4xl font-extrabold font-mono mt-2 ${getWaitTimeClass(metrics.avgWaitTime)}`}>
                    {formatWaitTime(metrics.avgWaitTime)}
                  </p>
                </div>
                <Clock size={24} className="text-[var(--text-secondary)] opacity-50 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                Calculated over the last 24 hours
              </p>
            </div>

            {/* Card 3: Revenue Today */}
            <div className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Revenue Today</p>
                  <p className="text-4xl font-extrabold font-mono text-success mt-2">
                    {formatCurrency(metrics.revenueToday)}
                  </p>
                </div>
                <IndianRupee size={24} className="text-success opacity-50 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                Total from completed billing sessions
              </p>
            </div>

            {/* Card 4: Open Tables */}
            <Link href="/tables" className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group block hover:no-underline cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Open Tables</p>
                  <p className="text-4xl font-extrabold font-mono text-[var(--text-primary)] mt-2">{metrics.openTables}</p>
                </div>
                <TableProperties size={24} className="text-[var(--text-secondary)] opacity-50 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                {metrics.occupiedTables} currently occupied dining tables
              </p>
            </Link>
            {/* Card 5: Average Rating */}
            <button
              onClick={() => setShowRatingsModal(true)}
              className="w-full text-left block border-0 bg-transparent p-0 outline-none cursor-pointer focus:outline-none"
            >
              <div className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                    Average Rating
                  </p>
                  <p className="text-4xl font-extrabold font-mono text-[var(--text-primary)] mt-2">
                     {Number(metrics.averageRating || 0).toFixed(1)} / 5
                  </p>
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                  Based on {metrics.ratingsCount || 0} customer ratings (Click to view reviews)
                </p>
              </div>
            </button>

            {/* Card 6: Staff Online */}
            <Link href="/users" className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group block hover:no-underline cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Staff Online</p>
                  <p className="text-4xl font-extrabold font-mono text-[var(--text-primary)] mt-2">{metrics.staffOnline}</p>
                </div>
                <Users size={24} className="text-[var(--text-secondary)] opacity-50 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
                Active staff shifts logged in now
              </p>
            </Link>
          </div>

          {/* New Section: Analytics (7-Day Revenue & Top 5 Items) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 7-Day Revenue Sparkline */}
            <div className="card bg-surface border border-border p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-4">7-Day Revenue Trend</p>
                {(!metrics.revenue7Days || metrics.revenue7Days.length === 0) ? (
                  <p className="text-sm text-[var(--text-muted)] italic">No revenue data for the past 7 days.</p>
                ) : (
                  <div className="flex items-end justify-between h-32 gap-2 mt-4">
                    {(() => {
                      const maxRev = Math.max(...metrics.revenue7Days.map(d => d.revenue));
                      return metrics.revenue7Days.map((day, idx) => {
                        const heightPct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0;
                        const dateLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' });
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 group">
                            <div className="w-full flex justify-center relative">
                              <div
                                className="w-full max-w-[24px] bg-[var(--accent)]/30 rounded-t-sm transition-all duration-300 group-hover:bg-[var(--accent)]"
                                style={{ height: `${Math.max(heightPct, 5)}%` }}
                              />
                              {/* Tooltip on hover */}
                              <div className="absolute -top-8 bg-background border border-border text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {formatCurrency(day.revenue)}
                              </div>
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] mt-2 uppercase tracking-wider">{dateLabel}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 Items */}
            <div className="card bg-surface border border-border p-6 rounded-2xl">
              <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-4">Top 5 Items (30 Days)</p>
              {(!metrics.top5Items || metrics.top5Items.length === 0) ? (
                <p className="text-sm text-[var(--text-muted)] italic">No item data available.</p>
              ) : (
                <div className="space-y-4">
                  {metrics.top5Items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)]">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</span>
                      </div>
                      <span className="text-xs font-mono bg-surface-raised px-2 py-1 rounded border border-border text-[var(--text-secondary)]">
                        {item.count} ordered
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="card bg-surface border border-border p-4 rounded-xl flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
            <span> Metrics update automatically via real-time stream.</span>
            <span>Last sync: just now</span>
          </div>
        </>
      )}

      {/* Ratings Dashboard Modal Overlay */}
      {showRatingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md animate-fade-in p-4 bg-zinc-950/20">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl p-6 relative flex flex-col h-[85vh] min-h-[600px]">
            {/* Close Modal Button */}
            <button
              onClick={() => setShowRatingsModal(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X size={20} />
            </button>

            {/* Modal Title */}
            <div className="border-b border-border/60 pb-3 pr-8">
              <h3 className="font-extrabold text-xl text-[var(--text-primary)] flex items-center gap-2">
                <span> Customer Feedback & Ratings</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background text-[var(--accent)] border border-border">
                   {Number(metrics.averageRating || 0).toFixed(1)} Avg
                </span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-semibold">
                Showing reviews and star ratings left by dining table sessions.
              </p>
            </div>

            {/* Modal Filters Toolbar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-background/50 border border-border/60 p-3 rounded-xl mt-4">
              {/* Search Bar */}
              <div className="relative col-span-2 md:col-span-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)]">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 bg-background border border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-xs transition-all text-[var(--text-primary)]"
                />
              </div>

              {/* Table Filter */}
              <div>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-background border border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-xs h-8 px-2 outline-none transition-all text-[var(--text-primary)] font-bold cursor-pointer"
                >
                  <option value="all">All Tables</option>
                  {uniqueTables.map(t => (
                    <option key={t} value={t}>Table {t}</option>
                  ))}
                </select>
              </div>

              {/* Rating Dropdown Filter */}
              <div>
                <select
                  value={selectedStars}
                  onChange={(e) => setSelectedStars(e.target.value)}
                  className="w-full bg-background border border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-xs h-8 px-2 outline-none transition-all text-[var(--text-primary)] font-bold cursor-pointer"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full bg-background border border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-xs h-8 px-2 outline-none transition-all text-[var(--text-primary)] font-bold cursor-pointer"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <select
                  value={selectedPriceRange}
                  onChange={(e) => setSelectedPriceRange(e.target.value)}
                  className="w-full bg-background border border-border focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-xs h-8 px-2 outline-none transition-all text-[var(--text-primary)] font-bold cursor-pointer"
                >
                  <option value="all">All Bills</option>
                  <option value="under500">Under ₹500</option>
                  <option value="500to1500">₹500 - ₹1500</option>
                  <option value="over1500">Over ₹1500</option>
                </select>
              </div>
            </div>

            {/* Ratings Scrollable Table Area */}
            <div className="flex-1 overflow-y-auto mt-4 border border-border/80 rounded-xl bg-background/10 p-3 space-y-4">
              {/* Rating Breakdown Section */}
              {!ratingsLoading && ratings.length > 0 && (
                <div className="bg-background/30 border border-border/50 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Rating Breakdown</h4>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = starCounts[star];
                      const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-3 text-xs">
                          <div className="w-16 flex items-center text-amber-500 font-medium shrink-0">
                            {star} {'★'.repeat(1)}
                          </div>
                          <div className="flex-1 h-2 bg-background border border-border/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-10 text-right text-[var(--text-muted)] font-mono font-semibold shrink-0">
                            {count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {ratingsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 size={24} className="animate-spin text-[var(--accent)] inline-block" />
                  <p className="mt-2 text-xs text-[var(--text-secondary)] font-semibold">Loading reviews…</p>
                </div>
              ) : filteredRatings.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-surface border-b border-border/80 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] z-10">
                    <tr>
                      <th className="text-left p-3.5">Table</th>
                      <th className="text-left p-3.5">Rating</th>
                      <th className="text-left p-3.5">Bill Amount</th>
                      <th className="text-left p-3.5">Feedback Comment</th>
                      <th className="text-left p-3.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {filteredRatings.map((rating) => (
                      <tr key={rating.id} className="hover:bg-background/20 transition-colors">
                        <td className="p-3.5 font-bold text-[var(--text-primary)]">
                          Table {rating.table_sessions?.tables?.table_number || 'N/A'}
                        </td>
                        <td className="p-3.5 text-amber-500 whitespace-nowrap">
                          {''.repeat(rating.rating)}{''.repeat(5 - rating.rating)}
                        </td>
                        <td className="p-3.5 font-mono text-[var(--text-primary)]">
                          {rating.table_sessions?.total_amount ? `₹${Number(rating.table_sessions.total_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3.5 max-w-xs">
                          {rating.feedback_comment ? (
                            <button
                              type="button"
                              onClick={() => setActiveComment({
                                table: rating.table_sessions?.tables?.table_number || 'N/A',
                                rating: rating.rating,
                                comment: rating.feedback_comment,
                                date: new Date(rating.created_at).toLocaleDateString()
                              })}
                              className="text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] underline cursor-pointer truncate block w-full transition-colors border-0 bg-transparent p-0 outline-none"
                            >
                              {rating.feedback_comment}
                            </button>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-xs text-[var(--text-muted)] font-semibold italic">
                  No customer reviews match your filters.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-border/60 mt-4">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                Total Shown: {filteredRatings.length} entries
              </span>
              <button
                type="button"
                onClick={() => setShowRatingsModal(false)}
                className="btn bg-background border-border hover:bg-surface text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nested View Comment Modal Popup */}
      {activeComment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xs animate-fade-in p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setActiveComment(null)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X size={18} />
            </button>

            <div className="border-b border-border/60 pb-3">
              <h4 className="font-extrabold text-md text-[var(--text-primary)]">
                Feedback Details: Table {activeComment.table}
              </h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-amber-500 text-xs">
                  {''.repeat(activeComment.rating)}{''.repeat(5 - activeComment.rating)}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] font-mono">
                  • {activeComment.date}
                </span>
              </div>
            </div>

            <div className="bg-background border border-border/80 rounded-xl p-4 max-h-60 overflow-y-auto">
              <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-medium">
                "{activeComment.comment}"
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveComment(null)}
                className="btn bg-background border-border hover:bg-surface text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
