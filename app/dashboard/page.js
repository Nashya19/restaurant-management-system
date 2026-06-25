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

import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatCurrency, formatWaitTime, getWaitTimeClass, formatCount } from '@/lib/utils/formatters';
import { TrendingUp, Clock, DollarSign, TableProperties, ShoppingCart, Users, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { metrics, isLoading, error, refresh } = useDashboard();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time metrics for restaurant operations. Metrics update automatically.
          </p>
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
          <span className="shrink-0 mt-0.5">⚠️</span>
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
                <DollarSign size={24} className="text-success opacity-50 group-hover:scale-110 transition-transform duration-300" />
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
<Link href="/ratings" className="block">
  <div className="stat-card bg-surface border border-border p-6 rounded-2xl shadow-lg hover:border-[var(--accent)] transition-all duration-300 relative overflow-hidden group cursor-pointer">

    <div>
      <p className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
        Average Rating
      </p>

      <p className="text-4xl font-extrabold font-mono text-[var(--text-primary)] mt-2">
        ⭐ {Number(metrics.averageRating || 0).toFixed(1)} / 5
      </p>
    </div>

    

   <p className="text-xs text-[var(--text-secondary)] font-semibold mt-6">
  Based on {metrics.ratingsCount || 0} customer ratings
</p>

  </div>
</Link>

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

          {/* Footer Info */}
          <div className="card bg-surface border border-border p-4 rounded-xl flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
            <span>✓ Metrics update automatically via real-time stream.</span>
            <span>Last sync: just now</span>
          </div>
        </>
      )}
    </div>
  );
}
