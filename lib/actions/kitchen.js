'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { handleSupabaseError } from '@/lib/utils/rls-checks';
import { computeLiveSecondsLeft, DEFAULT_AVG_PREP_MINUTES } from '@/lib/utils/wait-time';
import { getKitchenSettingsAction } from '@/lib/actions/kitchen-settings';

/**
 * Server Action: Update an order item's status (pending -> preparing -> ready)
 */
export async function updateOrderItemStatusAction(orderItemId, status) {
  const adminClient = createAdminClient();
  const serverClient = await createServerClient();
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? adminClient : serverClient;

  try {
    if (!['pending', 'preparing', 'ready'].includes(status)) {
      throw new Error('Invalid status');
    }

    const updateData = { item_status: status };
    if (status === 'preparing') updateData.item_started_at = new Date().toISOString();

    const { data, error } = await client
      .from('order_items')
      .update(updateData)
      .eq('id', orderItemId)
      .select();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update order item'));
    }

    const updatedItem = Array.isArray(data) ? data[0] : data;

    if (!updatedItem) {
      throw new Error('No order item was updated.');
    }

    // Update parent order status based on overall items state
    const orderId = updatedItem.order_id;
    const { data: allItems } = await client
      .from('order_items')
      .select('id, item_status, item_started_at, menu_items ( prep_time_minutes )')
      .eq('order_id', orderId);

    if (allItems) {
      const allReady = allItems.every(i => i.item_status === 'ready');
      const anyPrepare = allItems.some(i => i.item_status === 'preparing');

      if (allReady) {
        await client.from('orders').update({ status: 'delivered' }).eq('id', orderId);
      } else if (anyPrepare) {
        const { data: ord } = await client.from('orders').select('status').eq('id', orderId).single();
        if (ord?.status === 'placed') {
          await client.from('orders').update({ status: 'preparing' }).eq('id', orderId);
        }
      }

      // Recompute estimated_wait_minutes for the customer
      // Use the real-time seconds left from item-level data and round up to minutes
      const itemsForCalc = allItems.map(i => ({
        item_status: i.item_status,
        item_started_at: i.item_started_at,
        prep_time_minutes: i.menu_items?.prep_time_minutes ?? DEFAULT_AVG_PREP_MINUTES
      }));

      const secondsLeft = computeLiveSecondsLeft(itemsForCalc, new Date());

      if (secondsLeft !== null && !allReady) {
        const minsLeft = Math.max(1, Math.ceil(secondsLeft / 60));
        await client
          .from('orders')
          .update({ estimated_wait_minutes: minsLeft })
          .eq('id', orderId);
      }
    }

    return { success: true, data: updatedItem };
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function adjustOrderItemStartedAtAction(orderItemId, itemStartedAt) {
  const adminClient = createAdminClient();
  const serverClient = await createServerClient();
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? adminClient : serverClient;

  try {
    const { data, error } = await client
      .from('order_items')
      .update({ item_started_at: itemStartedAt })
      .eq('id', orderItemId)
      .select();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to adjust order item prep time'));
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function updateOrderStatusAction(orderId, status) {
  const adminClient = createAdminClient();
  const serverClient = await createServerClient();
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? adminClient : serverClient;

  try {
    if (!['placed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status)) {
      throw new Error('Invalid order status');
    }

    const { data, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update order status'));
    }

    const updatedOrder = Array.isArray(data) ? data[0] : data;

    if (!updatedOrder) {
      throw new Error('No order was updated.');
    }

    return { success: true, data: updatedOrder };
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function deleteOrderAction(orderId) {
  const adminClient = createAdminClient();
  const serverClient = await createServerClient();
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? adminClient : serverClient;

  try {
    const { error } = await client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to cancel order'));
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function completeOneOrderItemAction(orderItemId) {
  const adminClient = createAdminClient();
  const serverClient = await createServerClient();
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? adminClient : serverClient;

  try {
    const { data: item, error: getErr } = await client
      .from('order_items')
      .select('*')
      .eq('id', orderItemId)
      .single();

    if (getErr || !item) {
      throw new Error('Order item not found.');
    }

    if (item.quantity <= 1) {
      return await updateOrderItemStatusAction(orderItemId, 'ready');
    }

    const { error: decErr } = await client
      .from('order_items')
      .update({ quantity: item.quantity - 1 })
      .eq('id', orderItemId);

    if (decErr) {
      throw new Error('Failed to update original item quantity.');
    }

    const { data: existingReady, error: findErr } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', item.order_id)
      .eq('menu_item_id', item.menu_item_id)
      .eq('item_status', 'ready')
      .maybeSingle();

    if (existingReady) {
      const { error: incErr } = await client
        .from('order_items')
        .update({ quantity: existingReady.quantity + 1 })
        .eq('id', existingReady.id);

      if (incErr) {
        throw new Error('Failed to increment existing ready item.');
      }
    } else {
      const { error: insErr } = await client
        .from('order_items')
        .insert({
          order_id: item.order_id,
          menu_item_id: item.menu_item_id,
          quantity: 1,
          price_at_order: item.price_at_order,
          item_status: 'ready'
        });

      if (insErr) {
        throw new Error('Failed to insert new ready item.');
      }
    }

    const { data: allItems } = await client
      .from('order_items')
      .select('id, item_status')
      .eq('order_id', item.order_id);

    if (allItems) {
      const allReady = allItems.every(i => i.item_status === 'ready');
      if (allReady) {
        await client.from('orders').update({ status: 'delivered' }).eq('id', item.order_id);
      }
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}
