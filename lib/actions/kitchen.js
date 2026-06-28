'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

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
      .select('id, item_status')
      .eq('order_id', orderId);

    if (allItems) {
      const allReady = allItems.every(i => i.item_status === 'ready');
      const anyPrepare = allItems.some(i => i.item_status === 'preparing');

      if (allReady) {
        await client.from('orders').update({ status: 'ready' }).eq('id', orderId);
      } else if (anyPrepare) {
        const { data: ord } = await client.from('orders').select('status').eq('id', orderId).single();
        if (ord?.status === 'placed') {
          await client.from('orders').update({ status: 'preparing' }).eq('id', orderId);
        }
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
      .delete()
      .eq('id', orderId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to delete order'));
    }

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}
