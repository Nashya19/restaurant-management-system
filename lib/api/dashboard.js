/**
 * Dashboard API — Supabase Queries for Module 3: Dashboard
 * 
 * DESIGN DECISION: Centralized metric queries for admin dashboard.
 * All calculations done server-side (in Supabase queries) not client-side.
 * 
 * WHY Supabase queries vs. client-side aggregation?
 * - Supabase runs queries on database directly (fast, optimized)
 * - Client-side would fetch all rows then sum/avg/count (slow for large datasets)
 * - Supabase returns only the metric value (not raw data)
 * 
 * WHY REALTIME?
 * - Orders change frequently (placed → preparing → ready → delivered)
 * - Metrics should update instantly when status changes
 * - Supabase realtime subscriptions provide <100ms latency
 * - Better UX: admins see live data without refresh
 * 
 * METRICS (6 KPIs):
 * 1. Active Orders — COUNT orders WHERE status != 'delivered' | calls highlight
 * 2. Avg Wait Time — AVG(estimated_wait_minutes) for orders from last 24h
 * 3. Revenue Today — SUM(total_amount) from table_sessions WHERE DATE = TODAY
 * 4. Open Tables — COUNT table_sessions WHERE status = 'open'
 * 5. Avg Order Value — AVG(total_amount) from all orders (or today's only)
 * 6. Staff Online — COUNT shifts WHERE NOW BETWEEN start_time AND end_time
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';
 import { getTableStatus } from './table-sessions';

/**
 * Get count of active orders
 * "Active" = not delivered (placed, preparing, ready)
 * Highlighted on dashboard (one accent element rule)
 */
export async function getActiveOrdersCount() {
  const supabase = createClient();

  try {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['placed', 'preparing', 'ready']);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch active orders'));
    }

    return count || 0;
  } catch (err) {
    console.error('Error fetching active orders:', err);
    return 0;
  }
}

/**
 * Get average wait time for recent orders
 * Only orders from last 24 hours
 * Returns number in minutes
 */
export async function getAverageWaitTime() {
  const supabase = createClient();

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('orders')
      .select('estimated_wait_minutes')
      .gt('created_at', twentyFourHoursAgo)
      .not('estimated_wait_minutes', 'is', null);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch wait times'));
    }

    if (!data || data.length === 0) {
      return 0;
    }

    const total = data.reduce((sum, order) => sum + (order.estimated_wait_minutes || 0), 0);
    return Math.round(total / data.length);
  } catch (err) {
    console.error('Error calculating average wait time:', err);
    return 0;
  }
}

/**
 * Get revenue for today
 * SUM of total_amount from table_sessions where created_at = TODAY
 * Returns number (currency in cents/units depending on schema)
 */
export async function getRevenueToday() {
  const supabase = createClient();

  try {
    // Get today's date at midnight UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const todayEnd = tomorrow.toISOString();

    const { data, error } = await supabase
      .from('table_sessions')
      .select('total_amount')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch revenue'));
    }

    if (!data || data.length === 0) {
      return 0;
    }

    const total = data.reduce((sum, session) => sum + (parseFloat(session.total_amount) || 0), 0);
    return total;
  } catch (err) {
    console.error('Error calculating revenue:', err);
    return 0;
  }
}

/**
 * Get count of open tables
 * table_sessions.status = 'open'
 */
export async function getOpenTablesCount() {
  try {
    const tables = await getTableStatus();

    return tables.filter(
      (table) => table.current_status === 'open' && table.table_number !== 67
    ).length;
  } catch (err) {
    console.error('Error fetching open tables:', err);
    return 0;
  }
}

/**
 * Get count of occupied tables
 * (Active sessions with at least 1 connected device)
 */
export async function getOccupiedTablesCount() {
  try {
    const tables = await getTableStatus();
    return tables.filter(
      (table) =>
        table.table_number !== 67 &&
        (['locked', 'completed'].includes(table.current_status) ||
        (table.current_status === 'open' && table.connected_devices_count > 0))
    ).length;
  } catch (err) {
    console.error('Error fetching occupied tables count:', err);
    return 0;
  }
}


/**
 * Get average order value
 * AVG(total_amount) from all completed orders (or today's)
 * For MVP, calculating avg from all completed orders
 */
export async function getAverageOrderValue() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('orders(total_amount:table_sessions.total_amount)');

    // Simplified: fetch from table_sessions directly
    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('total_amount')
      .gt('total_amount', 0)
      .limit(100);

    if (sessionsError) {
      throw new Error(handleSupabaseError(sessionsError, 'Failed to fetch orders'));
    }

    if (!sessions || sessions.length === 0) {
      return 0;
    }

    const total = sessions.reduce((sum, session) => sum + (parseFloat(session.total_amount) || 0), 0);
    return total / sessions.length;
  } catch (err) {
    console.error('Error calculating average order value:', err);
    return 0;
  }
}
/**
 * Get average customer rating
 * AVG(rating) from all rated orders
 */
export async function getAverageRating() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('rating')
      .not('rating', 'is', null);

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to fetch ratings')
      );
    }

    if (!data || data.length === 0) {
      return 0;
    }

    const total = data.reduce(
      (sum, order) => sum + (parseFloat(order.rating) || 0),
      0
    );

    return total / data.length;
  } catch (err) {
    console.error('Error calculating average rating:', err);
    return 0;
  }
}
//ratings count
export async function getRatingsCount() {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null);

  if (error) return 0;

  return count || 0;
}
/**
 * Get all customer ratings with table details
 */
export async function getRatingsList() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
  id,
  rating,
  feedback_comment,
  created_at,
  table_sessions (
    id,
    total_amount,
    tables (
      table_number
    )
  )
`)
      .not('rating', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to fetch ratings')
      );
    }

    return (data || []).filter(
      (rating) => rating.table_sessions?.tables?.table_number !== 67
    );
  } catch (err) {
    console.error('Error fetching ratings list:', err);
    return [];
  }
}
/**
 * Get count of staff currently online (within active shifts)
 * COUNT distinct staff_id WHERE NOW BETWEEN shift.start_time AND shift.end_time
 */
export async function getStaffOnlineCount() {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    // Fetch active shifts
    const { data, error } = await supabase
      .from('shifts')
      .select('staff_id')
      .lte('start_time', now)
      .gte('end_time', now);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch staff'));
    }

    if (!data) {
      return 0;
    }

    // Count unique staff IDs
    const uniqueStaff = new Set(data.map((shift) => shift.staff_id));
    return uniqueStaff.size;
  } catch (err) {
    console.error('Error fetching staff online:', err);
    return 0;
  }
}


/**
 * Get all dashboard metrics in one call
 * Returns object: { activeOrders, avgWaitTime, revenueToday, openTables, avgOrderValue, staffOnline, revenue7Days, top5Items }
 * Used on initial page load
 */
export async function getDashboardSnapshot() {
  try {
    const [
      activeOrders,
      avgWaitTime,
      revenueToday,
      openTables,
      occupiedTables,
      averageRating,
      ratingsCount,
      staffOnline,
      revenue7Days,
      top5Items
    ] = await Promise.all([
      getActiveOrdersCount(),
      getAverageWaitTime(),
      getRevenueToday(),
      getOpenTablesCount(),
      getOccupiedTablesCount(),
      getAverageRating(),
      getRatingsCount(),
      getStaffOnlineCount(),
      get7DayRevenue(),
      getTop5Items(),
    ]);

    return {
      activeOrders,
      avgWaitTime,
      revenueToday,
      openTables,
      occupiedTables,
      averageRating,
      ratingsCount,
      staffOnline,
      revenue7Days,
      top5Items
    };
  } catch (err) {
    console.error('Error fetching dashboard snapshot:', err);
    return {
      activeOrders: 0,
      avgWaitTime: 0,
      revenueToday: 0,
      openTables: 0,
      occupiedTables: 0,
      averageRating: 0,
      ratingsCount: 0,
      staffOnline: 0,
      revenue7Days: [],
      top5Items: [],
    };
  }
}

/**
 * Subscribe to realtime changes for orders table
 * Returns unsubscribe function
 * 
 * USAGE:
 *   const unsubscribe = subscribeToOrderChanges((payload) => {
 *     console.log('Order changed:', payload);
 *     // Recalculate activeOrders count
 *   });
 */
export function subscribeToOrderChanges(callback) {
  const supabase = createClient();

  const channel = supabase
    .channel('orders-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Subscribe to realtime changes for table_sessions table
 * Tracks open tables and revenue changes
 */
export function subscribeToTableSessionChanges(callback) {
  const supabase = createClient();

  const channel = supabase
    .channel('table-sessions-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Get revenue for the past 7 days (grouped by day)
 */
export async function get7DayRevenue() {
  const supabase = createClient();
  try {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('table_sessions')
      .select('opened_at, total_amount, status')
      .gte('opened_at', sevenDaysAgo.toISOString())
      .lte('opened_at', today.toISOString());

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch 7-day revenue'));
    }

    // Group by day (YYYY-MM-DD)
    const dailyTotals = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      dailyTotals[dateStr] = 0;
    }

    if (data) {
      data.forEach(session => {
        if (session.total_amount) {
          const dateStr = session.opened_at.split('T')[0];
          if (dailyTotals[dateStr] !== undefined) {
            dailyTotals[dateStr] += session.total_amount;
          }
        }
      });
    }

    return Object.keys(dailyTotals).sort().map(date => ({
      date,
      revenue: dailyTotals[date]
    }));
  } catch (err) {
    console.error('Error fetching 7-day revenue:', err);
    return [];
  }
}

/**
 * Get top 5 items (all time or last 30 days) based on order quantities
 */
export async function getTop5Items() {
  const supabase = createClient();
  try {
    // Note: this fetches all order items for the last 30 days. In production with a huge DB this should be an RPC.
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        menu_items ( id, name )
      `)
      .neq('item_status', 'pending');

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch top items'));
    }

    if (!data) return [];

    const itemCounts = {};
    data.forEach(item => {
      const menuItem = item.menu_items;
      if (menuItem) {
        if (!itemCounts[menuItem.id]) {
          itemCounts[menuItem.id] = { name: menuItem.name, count: 0 };
        }
        itemCounts[menuItem.id].count += item.quantity;
      }
    });

    const sortedItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sortedItems;
  } catch (err) {
    console.error('Error fetching top 5 items:', err);
    return [];
  }
}
