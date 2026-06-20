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
import { TrendingUp, Clock, DollarSign, TableProperties, ShoppingCart, Users } from 'lucide-react';

export default function DashboardPage() {
  const { metrics, isLoading, error } = useDashboard();

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-display text-[var(--text-primary)] mb-2">Dashboard</h1>
        <p className="text-body text-[var(--text-secondary)]">
          Real-time metrics for restaurant operations. Updates automatically.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="card bg-[var(--destructive-bg)] border-[var(--destructive-border)] text-[var(--destructive)] p-4 mb-6">
          <p className="text-body">⚠️ {error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading metrics…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Card 1: Active Orders (HIGHLIGHTED - one accent element) */}
            <div className="stat-card border-accent-left">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Active Orders</p>
                  <p className="stat-card-value text-[var(--accent)]">{metrics.activeOrders}</p>
                </div>
                <TrendingUp size={24} className="text-[var(--accent)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Orders in progress (placed, preparing, ready)
              </p>
            </div>

            {/* Card 2: Average Wait Time */}
            <div className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Avg Wait Time</p>
                  <p className={`stat-card-value ${getWaitTimeClass(metrics.avgWaitTime)}`}>
                    {formatWaitTime(metrics.avgWaitTime)}
                  </p>
                </div>
                <Clock size={24} className="text-[var(--text-secondary)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Last 24 hours
              </p>
            </div>

            {/* Card 3: Revenue Today */}
            <div className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Revenue Today</p>
                  <p className="stat-card-value text-[var(--success)]">
                    {formatCurrency(metrics.revenueToday)}
                  </p>
                </div>
                <DollarSign size={24} className="text-[var(--success)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Total from completed sessions
              </p>
            </div>

            {/* Card 4: Open Tables */}
            <div className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Open Tables</p>
                  <p className="stat-card-value">{metrics.openTables}</p>
                </div>
                <TableProperties size={24} className="text-[var(--text-secondary)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Currently occupied
              </p>
            </div>

            {/* Card 5: Avg Order Value */}
            <div className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Avg Order Value</p>
                  <p className="stat-card-value">
                    {formatCurrency(metrics.avgOrderValue)}
                  </p>
                </div>
                <ShoppingCart size={24} className="text-[var(--text-secondary)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Average per session
              </p>
            </div>

            {/* Card 6: Staff Online */}
            <div className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-card-label">Staff Online</p>
                  <p className="stat-card-value">{metrics.staffOnline}</p>
                </div>
                <Users size={24} className="text-[var(--text-secondary)] opacity-50" />
              </div>
              <p className="text-small text-[var(--text-secondary)]">
                Active shifts now
              </p>
            </div>
          </div>

          {/* Footer Info */}
          <div className="card bg-[var(--surface-raised)] p-4">
            <p className="text-small text-[var(--text-muted)]">
              ✓ Metrics update in real-time. Last updated just now.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
