'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          estimated_wait_minutes,
          order_items(
            quantity,
            menu_items(
              name
            )
          )
        `)
        .in('status', ['placed', 'preparing', 'ready']);

      if (!error) {
        setOrders(data);
      } else {
        console.error(error);
      }
    };

    fetchOrders();
  }, []);
const updateStatus = async (orderId, status) => {

  const supabase = createClient();

  const { error } = await supabase
    .from('orders')
    .update({
      status: status
    })
    .eq('id', orderId);

  if (error) {
    console.error(error);
  } else {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? { ...order, status }
          : order
      )
    );
  }
};
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Kitchen Display
      </h1>

      {orders.map(order => (
        <div
          key={order.id}
          className="border rounded p-4 mb-4"
        >
          <h2 className="font-bold">
            Order #{order.id}
          </h2>

          <div className="flex gap-2 mt-2">

  <span>
    Status: {order.status}
  </span>

  {order.status === 'placed' && (
    <button
      onClick={() => updateStatus(order.id, 'preparing')}
      className="px-2 py-1 bg-orange-500 text-white rounded"
    >
      Start Preparing
    </button>
  )}

  {order.status === 'preparing' && (
    <button
      onClick={() => updateStatus(order.id, 'ready')}
      className="px-2 py-1 bg-green-500 text-white rounded"
    >
      Mark Ready
    </button>
  )}

</div>

          <p>
            Estimated Wait: {order.estimated_wait_minutes || 0} mins
          </p>

          <div className="mt-2">
            {order.order_items?.map((item, index) => (
              <div key={index}>
                {item.menu_items?.name} x{item.quantity}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}