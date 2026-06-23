/**
 * Table Sessions API — Supabase Queries for Session Management (Module 7.3)
 *
 * Handles all table session operations: starting sessions, managing status,
 * tracking connected devices, and retrieving session details with realtime support.
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Generate a unique 4-digit PIN
 */
function generateSessionPIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Get all tables with current session status and statistics
 */
export async function getTableStatus() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        id,
        table_number,
        capacity,
        qr_code_url,
        created_at,
        is_active,
        table_sessions (
  id,
  pin,
  status,
  opened_at,
  completed_at,
  cleared_at,
  total_amount,
  orders (
  id
),
  session_devices (
    id
  )
)
      `)
      .order('table_number', { ascending: true });

    if (error) throw error;

     return data
  .map((table) => {
    console.log(
  'Table',
  table.table_number,
  table.table_sessions
);
    const currentSession =
  table.table_sessions?.sort(
    (a, b) =>
      new Date(b.opened_at || 0) -
      new Date(a.opened_at || 0)
  )[0];
  console.log(
  "TABLE",
  table.table_number,
  "CURRENT SESSION",
  currentSession
);
    const running_total =
  currentSession &&
  ['open', 'locked'].includes(currentSession.status)
    ? currentSession.total_amount || 0
    : 0;
    const connected_devices_count =
  currentSession &&
  ['open', 'locked'].includes(currentSession.status)
    ? currentSession.session_devices?.length || 0
    : 0;
    const orders_count =
  currentSession &&
  ['open', 'locked'].includes(currentSession.status)
    ? currentSession?.orders?.length || 0
    : 0;

    return {
      id: table.id,
      table_number: table.table_number,
      capacity: table.capacity,
      qr_code_url: table.qr_code_url,
      created_at: table.created_at,
      is_active: table.is_active,
      current_status: !table.is_active
  ? 'deactivated'
  : (currentSession?.status || 'inactive'),
      current_pin: currentSession?.pin || null,
      session_id: currentSession?.id || null,
      session_started_at:
  currentSession &&
  ['open', 'locked'].includes(currentSession.status)
    ? currentSession.opened_at
    : null,
      running_total,
      connected_devices_count,
      orders_count,
    };
  })
  .sort((a, b) => {
    if (a.is_active === b.is_active) {
      return a.table_number - b.table_number;
    }

    return a.is_active ? -1 : 1;
  });
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Start a new table session with a generated PIN
 */
export async function startTableSession(tableId) {
  const supabase = createClient();

  try {
    const pin = generateSessionPIN();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('table_sessions')
      .insert([
        {
          table_id: tableId,
          pin,
          status: 'open',
          opened_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Lock a table session (prevent new devices from joining)
 */
export async function lockTableSession(sessionId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('table_sessions')
      .update({ status: 'locked' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Complete a table session (trigger bill generation)
 */
export async function completeTableSession(sessionId) {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('table_sessions')
      .update({ status: 'completed', completed_at: now })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Clear a table (archive session and disconnect devices)
 */
export async function clearTableSession(sessionId) {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    // Mark session as cleared
    const { data: sessionData, error: sessionError } = await supabase
      .from('table_sessions')
      .update({ status: 'cleared', cleared_at: now })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Fetch the table details to see if it is active
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('id, is_active')
      .eq('id', sessionData.table_id)
      .single();

    if (!tableError && tableData && tableData.is_active) {
      // Auto-start next session
      const newPin = generateSessionPIN();
      await supabase
        .from('table_sessions')
        .insert([
          {
            table_id: tableData.id,
            pin: newPin,
            status: 'open',
            opened_at: now,
          }
        ]);
    }

    return sessionData;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Emergency cancel (admin only) - cancel session without bill
 */
export async function cancelTableSession(sessionId) {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    // Mark session as cancelled
    const { data: sessionData, error: sessionError } = await supabase
      .from('table_sessions')
      .update({
        status: 'cleared',
        completed_at: now
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Fetch the table details to see if it is active
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('id, is_active')
      .eq('id', sessionData.table_id)
      .single();

    if (!tableError && tableData && tableData.is_active) {
      // Auto-start next session
      const newPin = generateSessionPIN();
      await supabase
        .from('table_sessions')
        .insert([
          {
            table_id: tableData.id,
            pin: newPin,
            status: 'open',
            opened_at: now,
          }
        ]);
    }

    return sessionData;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Get detailed session information with orders and devices
 */
export async function getSessionDetails(sessionId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
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
          device_fingerprint,
          joined_at
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    // Calculate totals
    const runningTotal = data.total_amount || 0;
    const sessionDuration = data.completed_at || data.cleared_at
      ? new Date(data.completed_at || data.cleared_at) - new Date(data.opened_at)
      : new Date() - new Date(data.opened_at);

    // Transform orders to include item info
    const orders = (data.orders || []).map((order) => {
      const items = order.order_items || [];
      const totalPrice = items.reduce((sum, item) => sum + (item.quantity * item.price_at_order), 0);
      const itemName = items.map((item) => item.menu_items?.name).join(', ');
      
      return {
        id: order.id,
        item_name: itemName || 'Order',
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        total_price: totalPrice,
        status: order.status,
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
      connected_devices_count: (data.session_devices || []).length,
      orders_count: orders.length,
    };
  } catch (err) {
    throw handleSupabaseError(err);
  }
}

/**
 * Get the running total for a session
 */
export async function getSessionRunningTotal(sessionId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('table_sessions')
      .select('total_amount')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data.total_amount || 0;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}
/**
 * Find active session by table number and PIN
 * Used by customer QR flow
 */
export async function validateSessionPin(tableNumber, pin) {
  const supabase = createClient();

  const { data, error } = await supabase
  .from('table_sessions')
  .select('*')
  .eq('pin', pin);

  console.log('DB DATA:', data);
  console.log('DB ERROR:', error);

  return data?.[0] || null;
}

/**
 * Retrieve all sessions for reporting/history, ordering by opened_at descending
 */
export async function getAllSessions() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
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

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleSupabaseError(err);
  }
}