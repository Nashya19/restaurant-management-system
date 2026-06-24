/**
 * Billing API — Supabase Queries for Module 9: Billing & Payments
 *
 * Covers:
 *  - Pending payments (sessions with status = 'completed')
 *  - Revenue analytics (daily/weekly/monthly sums)
 *  - Full session history with rich order breakdown
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Fetch all sessions awaiting payment confirmation (status = 'completed').
 * These are sessions where the customer has ended ordering but payment
 * has not been confirmed by staff yet.
 */
export async function getPendingPayments() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('table_sessions')
      .select(`
        id,
        pin,
        status,
        opened_at,
        completed_at,
        total_amount,
        tables (
          id,
          table_number,
          capacity
        ),
        orders (
          id,
          status,
          created_at,
          order_items (
            quantity,
            price_at_order,
            menu_items (
              name
            )
          )
        ),
        session_devices (
          id,
          last_active_at
        )
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((session) => {
      const totalItems = (session.orders || []).reduce(
        (sum, o) =>
          sum + (o.order_items || []).reduce((s, i) => s + i.quantity, 0),
        0
      );
      const ordersCount = (session.orders || []).length;
      const waitMinutes = session.completed_at
        ? Math.round(
            (Date.now() - new Date(session.completed_at).getTime()) / 60000
          )
        : 0;

      return {
        id: session.id,
        pin: session.pin,
        status: session.status,
        opened_at: session.opened_at,
        completed_at: session.completed_at,
        total_amount: session.total_amount || 0,
        table_number: session.tables?.table_number,
        table_capacity: session.tables?.capacity,
        orders_count: ordersCount,
        total_items: totalItems,
        wait_minutes: waitMinutes,
      };
    });
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Fetch full session history with filters.
 * Ordered by opened_at desc (most recent first).
 */
export async function getBillingHistory({ status = null } = {}) {
  const supabase = createClient();
  try {
    let query = supabase
      .from('table_sessions')
      .select(`
        id,
        pin,
        status,
        opened_at,
        completed_at,
        cleared_at,
        total_amount,
        tables (
          table_number
        ),
        orders (
          id
        ),
        session_devices (
          id
        )
      `)
      .order('opened_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Compute revenue analytics: today, this week, this month, all-time.
 */
export async function getRevenueAnalytics() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('table_sessions')
      .select('total_amount, cleared_at, completed_at, opened_at, status')
      .in('status', ['cleared', 'completed']);

    if (error) throw error;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let revenueToday = 0;
    let revenueWeek = 0;
    let revenueMonth = 0;
    let revenueAllTime = 0;
    let paidSessionsToday = 0;
    let paidSessionsMonth = 0;

    (data || []).forEach((s) => {
      const amount = parseFloat(s.total_amount) || 0;
      // Only count cleared sessions as "paid" for revenue
      if (s.status !== 'cleared') return;
      const closedAt = s.cleared_at ? new Date(s.cleared_at) : null;
      if (!closedAt) return;

      revenueAllTime += amount;

      if (closedAt >= startOfMonth) {
        revenueMonth += amount;
        paidSessionsMonth++;
      }
      if (closedAt >= startOfWeek) {
        revenueWeek += amount;
      }
      if (closedAt >= startOfToday) {
        revenueToday += amount;
        paidSessionsToday++;
      }
    });

    const avgToday =
      paidSessionsToday > 0 ? revenueToday / paidSessionsToday : 0;
    const avgMonth =
      paidSessionsMonth > 0 ? revenueMonth / paidSessionsMonth : 0;

    return {
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueAllTime,
      paidSessionsToday,
      paidSessionsMonth,
      avgToday,
      avgMonth,
    };
  } catch (err) {
    console.error('Error computing revenue analytics:', err);
    return {
      revenueToday: 0,
      revenueWeek: 0,
      revenueMonth: 0,
      revenueAllTime: 0,
      paidSessionsToday: 0,
      paidSessionsMonth: 0,
      avgToday: 0,
      avgMonth: 0,
    };
  }
}
