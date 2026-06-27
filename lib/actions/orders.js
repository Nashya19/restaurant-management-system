'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Server Action: Place a new customer order and order items, bypassing RLS
 * recalculates and updates the session's total_amount.
 */
export async function placeOrderAction(sessionId, items) {
  const adminClient = createAdminClient();

  try {
    // 1a. Check if session status is open or locked before allowing order
    const { data: sessionCheck, error: sessionCheckError } = await adminClient
      .from('table_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (sessionCheckError || !sessionCheck || !['open', 'locked'].includes(sessionCheck.status)) {
      throw new Error('This session is no longer open for placing orders.');
    }

    // 1b. Insert the order
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert([
        {
          session_id: sessionId,
          status: 'placed'
        }
      ])
      .select()
      .single();

    if (orderError) {
      throw new Error(handleSupabaseError(orderError, 'Failed to insert order'));
    }

    // 2. Insert order items
    const orderItemsData = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.item.id,
      quantity: item.qty,
      price_at_order: item.item.price,
      item_status: 'pending'
    }));

    const { error: itemsError } = await adminClient
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) {
      throw new Error(handleSupabaseError(itemsError, 'Failed to insert order items'));
    }

    // 3. Recalculate and update the running total amount in table_sessions
    const { data: sessionOrders, error: fetchErr } = await adminClient
      .from('orders')
      .select(`
        id,
        status,
        order_items (
          quantity,
          price_at_order
        )
      `)
      .eq('session_id', sessionId)
      .neq('status', 'cancelled');

    if (fetchErr) {
      throw new Error(handleSupabaseError(fetchErr, 'Failed to fetch session orders for total calculation'));
    }

    let newTotal = 0;
    if (sessionOrders) {
      sessionOrders.forEach(o => {
        if (o.order_items) {
          o.order_items.forEach(item => {
            newTotal += item.quantity * item.price_at_order;
          });
        }
      });
    }

    const { error: updateErr } = await adminClient
      .from('table_sessions')
      .update({ 
        total_amount: newTotal,
        status: sessionCheck.status === 'open' ? 'locked' : sessionCheck.status
      })
      .eq('id', sessionId);

    if (updateErr) {
      throw new Error(handleSupabaseError(updateErr, 'Failed to update table session running total'));
    }

    return { success: true, orderId: order.id };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Get detailed session information with orders and devices, bypassing RLS
 */
export async function getSessionDetailsAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('table_sessions')
      .select(`
        id,
        table_id,
        pin,
        status,
        opened_at,
        completed_at,
        cleared_at,
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
          estimated_wait_minutes,
          order_items (
            id,
            quantity,
            price_at_order,
            item_status,
            item_started_at,
            menu_items (
              name,
              prep_time_minutes
            )
          )
        ),
        session_devices (
          id,
          device_fingerprint,
          joined_at,
          last_active_at
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    // Calculate totals
    const runningTotal = data.total_amount || 0;
    
    // Find the timestamp of the first order
    const sessionOrders = data.orders || [];
    const firstOrderTimestamp = sessionOrders.length > 0
      ? new Date(Math.min(...sessionOrders.map(o => new Date(o.created_at))))
      : null;

    let sessionDuration = 0;
    if (firstOrderTimestamp) {
      const endTime = data.completed_at || data.cleared_at
        ? new Date(data.completed_at || data.cleared_at)
        : new Date();
      sessionDuration = Math.max(0, endTime - firstOrderTimestamp);
    }

    // Transform orders to include item info
    const orders = (data.orders || []).map((order) => {
      const itemsRaw = order.order_items || [];
      const totalPrice = itemsRaw.reduce((sum, item) => sum + (item.quantity * item.price_at_order), 0);
      const itemName = itemsRaw.map((item) => item.menu_items?.name).join(', ');
      
      const items = itemsRaw.map(item => ({
        id: item.id,
        name: item.menu_items?.name || 'Item',
        quantity: item.quantity,
        price_at_order: item.price_at_order,
        subtotal: item.quantity * item.price_at_order,
        status: item.item_status || 'pending',
        item_started_at: item.item_started_at,
        prep_time_minutes: item.menu_items?.prep_time_minutes || 15
      }));

      return {
        id: order.id,
        item_name: itemName || 'Order',
        items,
        quantity: itemsRaw.reduce((sum, item) => sum + item.quantity, 0),
        total_price: totalPrice,
        status: order.status,
        estimated_wait_minutes: order.estimated_wait_minutes || null,
        created_at: order.created_at,
      };
    });

    return {
      id: data.id,
      pin: data.pin,
      status: data.status,
      started_at: data.opened_at,
      tables: data.tables,
      orders,
      session_devices: data.session_devices || [],
      running_total: runningTotal,
      session_duration_ms: sessionDuration,
      connected_devices_count: (data.session_devices || []).filter(d => {
        if (!d.last_active_at) return true;
        return new Date(d.last_active_at).getTime() > (Date.now() - 30000);
      }).length,
      orders_count: orders.length,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Complete a table session (trigger bill generation / payment pending), bypassing RLS
 */
export async function completeTableSessionAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    const { data: session, error: getErr } = await adminClient
      .from('table_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (getErr || !session) {
      throw new Error('Table session not found.');
    }
    if (session.status !== 'locked') {
      throw new Error('Only a locked session can end ordering and generate a bill.');
    }

    const now = new Date().toISOString();

    const { data, error } = await adminClient
      .from('table_sessions')
      .update({ status: 'completed', completed_at: now })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to complete session'));
    }
    return { success: true, data };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Temporarily unlock a table session for 30 seconds
 */
export async function temporarilyUnlockSessionAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    const unlockUntil = new Date(Date.now() + 30 * 1000).toISOString();

    const { data, error } = await adminClient
      .from('table_sessions')
      .update({ unlock_until: unlockUntil })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to unlock session'));
    }
    return { success: true, data };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Clear a table session after customer confirms payment
 * and completes feedback. Bypasses RLS via admin client.
 * Called from the customer feedback page.
 */
export async function clearTableSessionAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    const now = new Date().toISOString();

    // Mark session as cleared
    const { data: sessionData, error: sessionError } = await adminClient
      .from('table_sessions')
      .update({ status: 'cleared', cleared_at: now })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) throw new Error(handleSupabaseError(sessionError, 'Failed to clear session'));

    // Fetch the table to check if it is still active
    const { data: tableData, error: tableError } = await adminClient
      .from('tables')
      .select('id, is_active')
      .eq('id', sessionData.table_id)
      .single();

    if (!tableError && tableData && tableData.is_active) {
      // Auto-start next session so the table is ready immediately
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      await adminClient.from('table_sessions').insert([{
        table_id: tableData.id,
        pin: newPin,
        status: 'open',
        opened_at: now,
      }]);
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}
/**
 * Server Action: Save customer rating for all orders in a session
 */
export async function submitRatingAction(sessionId, rating) {
  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from('orders')
      .update({ rating })
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Update device last active timestamp, bypassing RLS
 */
export async function sendHeartbeatAction(sessionId, deviceFingerprint) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('session_devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('device_fingerprint', deviceFingerprint)
      .select();

    if (error) {
      return { success: false, error: handleSupabaseError(error, 'Failed to update heartbeat') };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Server Action: Get queue status and orders ahead for a session, bypassing RLS
 */
export async function getQueueStatusAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    // 1. Get all active orders for this session
    const { data: ourOrders, error: ourOrdersErr } = await adminClient
      .from('orders')
      .select('id, created_at, status')
      .eq('session_id', sessionId)
      .in('status', ['placed', 'preparing']);

    if (ourOrdersErr) throw ourOrdersErr;

    if (!ourOrders || ourOrders.length === 0) {
      return { ordersAhead: 0, totalOrdersInQueue: 0 };
    }

    // Earliest active order timestamp
    const earliestTime = new Date(Math.min(...ourOrders.map(o => new Date(o.created_at))));

    // 2. Count other active orders created before our earliest time
    const { data: otherOrders, error: otherOrdersErr } = await adminClient
      .from('orders')
      .select('id, session_id')
      .in('status', ['placed', 'preparing'])
      .lt('created_at', earliestTime.toISOString());

    if (otherOrdersErr) throw otherOrdersErr;

    // Filter out orders that belong to the SAME session
    const uniqueOtherSessions = new Set(
      otherOrders
        .filter(o => o.session_id !== sessionId)
        .map(o => o.session_id)
    );

    const ordersAhead = uniqueOtherSessions.size;

    return {
      ordersAhead,
      totalOrdersInQueue: otherOrders.length + ourOrders.length
    };
  } catch (err) {
    console.error('Failed to get queue status:', err);
    return { ordersAhead: 0, totalOrdersInQueue: 0 };
  }
}
