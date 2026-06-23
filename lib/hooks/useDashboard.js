/**
 * useDashboard Hook
 * 
 * DESIGN DECISION: Manages dashboard metric state and realtime subscriptions.
 * 
 * Responsibilities:
 * 1. Fetch all metrics on mount (initial snapshot)
 * 2. Subscribe to realtime changes for instant updates
 * 3. Update individual metrics when realtime events arrive
 * 4. Cleanup subscriptions on unmount
 * 
 * WHY separate hook?
 * - Dashboard logic is complex (subscriptions, cleanup, multiple state values)
 * - Isolating in hook makes it testable and reusable across pages
 * - Component stays clean: just calls hook and renders
 * 
 * PERFORMANCE:
 * - Initial load: Promise.all() fetches all 6 metrics in parallel (~1-2 sec)
 * - Realtime updates: Only recalculate affected metrics (O(1) per event)
 * - Memory: Subscriptions cleaned up on unmount (no memory leaks)
 * 
 * ERROR HANDLING:
 * - If fetch fails, returns 0 for all metrics (see dashboard.js)
 * - If subscription fails, continues with polling-less updates (graceful degradation)
 * - No error toast (background updates; user sees stale data briefly)
 */

'use client';

import { useEffect, useState } from 'react';
import {
  getDashboardSnapshot,
  subscribeToOrderChanges,
  subscribeToTableSessionChanges,
  getActiveOrdersCount,
  getRevenueToday,
  getOpenTablesCount,
  getOccupiedTablesCount,
  getAverageWaitTime,
} from '@/lib/api/dashboard';

export function useDashboard() {
  const [metrics, setMetrics] = useState({
    activeOrders: 0,
    avgWaitTime: 0,
    revenueToday: 0,
    openTables: 0,
    occupiedTables: 0,
    avgOrderValue: 0,
    staffOnline: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial snapshot
  const fetchSnapshot = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const snapshot = await getDashboardSnapshot();
      setMetrics(snapshot);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();

    // Subscribe to order changes
    const unsubscribeOrders = subscribeToOrderChanges(async (payload) => {
      // When an order changes, recalculate affected metrics
      try {
        const [activeOrders, avgWaitTime] = await Promise.all([
          getActiveOrdersCount(),
          getAverageWaitTime(),
        ]);

        setMetrics((prev) => ({
          ...prev,
          activeOrders,
          avgWaitTime,
        }));
      } catch (err) {
        console.error('Error updating metrics from order change:', err);
      }
    });

    // Subscribe to table session changes
    const unsubscribeSessions = subscribeToTableSessionChanges(async (payload) => {
      // When a table session changes, recalculate affected metrics
      try {
        const [revenueToday, openTables, occupiedTables] = await Promise.all([
          getRevenueToday(),
          getOpenTablesCount(),
          getOccupiedTablesCount()
        ]);

        setMetrics((prev) => ({
          ...prev,
          revenueToday,
          openTables,
          occupiedTables,
        }));
      } catch (err) {
        console.error('Error updating metrics from session change:', err);
      }
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeOrders();
      unsubscribeSessions();
    };
  }, []);

  return { metrics, isLoading, error, refresh: () => fetchSnapshot(true) };
}
