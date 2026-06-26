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

    return { success: true, data: updatedItem };
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
