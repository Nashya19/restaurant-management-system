'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';
import { computeEstimatedWait } from '@/lib/utils/wait-time';
import { getKitchenSettingsAction } from '@/lib/actions/kitchen-settings';

/**
 * Server Action: Get all cart items for a table session
 */
export async function getCartItemsAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('cart_items')
      .select(`
        id,
        session_id,
        menu_item_id,
        quantity,
        menu_items (
          id,
          name,
          price,
          is_available
        )
      `)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch cart items'));
    }

    return data || [];
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Update or insert a cart item quantity
 */
export async function updateCartItemAction(sessionId, menuItemId, quantity) {
  const adminClient = createAdminClient();

  try {
    // 1. Verify session is open or locked
    const { data: session, error: sessionErr } = await adminClient
      .from('table_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session || !['open', 'locked'].includes(session.status)) {
      throw new Error('This session is no longer open for editing the cart.');
    }

    // 2. If quantity is <= 0, delete the item
    if (quantity <= 0) {
      const { error: deleteErr } = await adminClient
        .from('cart_items')
        .delete()
        .eq('session_id', sessionId)
        .eq('menu_item_id', menuItemId);

      if (deleteErr) {
        throw new Error(handleSupabaseError(deleteErr, 'Failed to remove item from cart'));
      }
      return { success: true, removed: true };
    }

    // 3. Upsert the item
    const { data, error: upsertErr } = await adminClient
      .from('cart_items')
      .upsert(
        {
          session_id: sessionId,
          menu_item_id: menuItemId,
          quantity: quantity
        },
        { onConflict: 'session_id,menu_item_id' }
      )
      .select()
      .single();

    if (upsertErr) {
      throw new Error(handleSupabaseError(upsertErr, 'Failed to update cart item'));
    }

    return { success: true, data };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Submit the shared cart, creating an order and clearing the cart
 */
export async function submitSharedOrderAction(sessionId) {
  const adminClient = createAdminClient();

  try {
    // 1. Verify session is open or locked
    const { data: session, error: sessionErr } = await adminClient
      .from('table_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session || !['open', 'locked'].includes(session.status)) {
      throw new Error('This session is no longer open for placing orders.');
    }

    // 2. Fetch all cart items
    const { data: cartItems, error: cartErr } = await adminClient
      .from('cart_items')
      .select(`
        quantity,
        menu_item_id,
        menu_items (
          price,
          is_available,
          prep_time_minutes
        )
      `)
      .eq('session_id', sessionId);

    if (cartErr) {
      throw new Error(handleSupabaseError(cartErr, 'Failed to fetch cart items for submission'));
    }

    if (!cartItems || cartItems.length === 0) {
      throw new Error('The shared cart is empty.');
    }

    // 3a. Compute estimated wait time based on current queue depth
    const [queueResult, kitchenSettings] = await Promise.all([
      adminClient
        .from('order_items')
        .select(`
          item_status,
          menu_items ( prep_time_minutes )
        `)
        .in('item_status', ['pending', 'preparing'])
        .not('order_id', 'is', null),
      getKitchenSettingsAction()
    ]);

    // Fetch orders placed before now from OTHER sessions to find items ahead
    const { data: queuedItemsRaw } = queueResult;
    const queuedItems = (queuedItemsRaw || []).map(i => ({
      item_status: i.item_status,
      prep_time_minutes: i.menu_items?.prep_time_minutes
    }));

    const newOrderItemsForCalc = cartItems.map(ci => ({
      prep_time_minutes: ci.menu_items?.prep_time_minutes,
      quantity: ci.quantity
    }));

    const estimatedWait = computeEstimatedWait(
      newOrderItemsForCalc,
      queuedItems,
      kitchenSettings.kitchenSlots
    );

    // 3b. Create the order with estimated wait
    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .insert([
        {
          session_id: sessionId,
          status: 'placed',
          estimated_wait_minutes: estimatedWait
        }
      ])
      .select()
      .single();

    if (orderErr) {
      throw new Error(handleSupabaseError(orderErr, 'Failed to insert order'));
    }

    // 4. Map and insert order items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      price_at_order: item.menu_items?.price || 0.00,
      item_status: 'pending'
    }));

    const { error: itemsErr } = await adminClient
      .from('order_items')
      .insert(orderItemsData);

    if (itemsErr) {
      // Rollback order insert if possible (delete the created order)
      await adminClient.from('orders').delete().eq('id', order.id);
      throw new Error(handleSupabaseError(itemsErr, 'Failed to insert order items'));
    }

    // 5. Clear the cart
    const { error: clearErr } = await adminClient
      .from('cart_items')
      .delete()
      .eq('session_id', sessionId);

    if (clearErr) {
      console.error('Failed to clear cart after order placement:', clearErr);
    }

    // 6. Recalculate and update the running total amount in table_sessions
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
        status: session.status === 'open' ? 'locked' : session.status
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
