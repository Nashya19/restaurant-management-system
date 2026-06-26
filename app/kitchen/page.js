'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const supabase = createClient();

   const fetchOrders = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      estimated_wait_minutes,
      created_at,

      table_sessions:session_id(
        tables:table_id(
          table_number
        )
      ),

      order_items(
        id,
        quantity,
        item_status,
        menu_items(
          name
        )
      )
    `)
    .in('status', ['placed', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log('Kitchen Orders:', data);

  setOrders(data || []);
};

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('kitchen-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const updateOrderStatus = async (orderId, status) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      console.error(error);
      return;
    }

    fetchOrders();
  };

  const updateItemStatus = async (itemId, nextStatus) => {
    const { error } = await supabase
      .from('order_items')
      .update({
        item_status: nextStatus,
      })
      .eq('id', itemId);

    if (error) {
      console.error(error);
      return;
    }

    const currentOrder = orders.find(order =>
      order.order_items.some(item => item.id === itemId)
    );

    if (!currentOrder) {
      fetchOrders();
      return;
    }

    const updatedItems = currentOrder.order_items.map(item =>
      item.id === itemId
        ? { ...item, item_status: nextStatus }
        : item
    );

    const allReady = updatedItems.every(
      item => item.item_status === 'ready'
    );

    const anyPreparing = updatedItems.some(
      item => item.item_status === 'preparing'
    );

    if (allReady) {
      await updateOrderStatus(currentOrder.id, 'ready');
    } else if (anyPreparing) {
      await updateOrderStatus(currentOrder.id, 'preparing');
    } else {
      await updateOrderStatus(currentOrder.id, 'placed');
    }

    fetchOrders();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Kitchen Display
      </h1>

      {orders.map(order => (
        <div
          key={order.id}
          className="border rounded-lg p-4 mb-4 bg-white shadow"
        >
          <h2 className="font-bold text-xl mb-2">
            🍽 Table{' '}
            {order.table_sessions?.tables?.table_number}
          </h2>

          <div className="mb-3">
            <span className="font-medium">
              Order Status:
            </span>{' '}
            <span className="capitalize">
              {order.status}
            </span>
          </div>

          <div className="mb-3 text-sm text-gray-600">
            Estimated Wait:{' '}
            {order.estimated_wait_minutes || 0} mins
          </div>

          <div className="space-y-2">
            {order.order_items?.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between border rounded p-2"
              >
                <div>
                  <div className="font-medium">
                    {item.menu_items?.name}
                  </div>

                  <div className="text-sm text-gray-500">
                    Qty: {item.quantity}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm capitalize">
                    {item.item_status}
                  </span>

                  {item.item_status === 'pending' && (
                    <button
                      onClick={() =>
                        updateItemStatus(
                          item.id,
                          'preparing'
                        )
                      }
                      className="px-3 py-1 bg-orange-500 text-white rounded"
                    >
                      Start
                    </button>
                  )}

                  {item.item_status === 'preparing' && (
                    <button
                      onClick={() =>
                        updateItemStatus(
                          item.id,
                          'ready'
                        )
                      }
                      className="px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Done
                    </button>
                  )}

                  {item.item_status === 'ready' && (
                    <span className="text-green-600 font-bold">
                      ✓ Ready
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}