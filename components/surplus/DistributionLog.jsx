"use client";

import { useEffect, useState } from "react";

export default function DistributionLog() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch("/api/surplus")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch(console.error);
  }, []);

  // Sort: Active items first, then Claimed, newest first
  const sortedItems = [...items].sort((a, b) => {
    if (a.quantity > 0 && b.quantity === 0) return -1;
    if (a.quantity === 0 && b.quantity > 0) return 1;

    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Show only the latest 10 records
  const latestItems = sortedItems.slice(0, 10);

  return (
    <div className="card border border-border rounded-xl p-6 bg-surface">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          Distribution Log
        </h2>

        <span className="text-sm text-[var(--text-secondary)]">
          Showing latest {latestItems.length} records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3">Food Item</th>
              <th className="py-3">Quantity</th>
              <th className="py-3">Discount Price</th>
              <th className="py-3">Pickup End</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {latestItems.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border hover:bg-gray-50 transition"
              >
                <td className="py-4 font-medium">
                  {item.menu_items?.name}
                </td>

                <td className="py-4">
                  {item.quantity}
                </td>

                <td className="py-4">
                  ${item.discounted_price}
                </td>

                <td className="py-4">
                  {new Date(item.pickup_window_end).toLocaleDateString()}
                </td>

                <td className="py-4">
                  {item.quantity === 0 ? (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      CLAIMED
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                      ACTIVE
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {latestItems.length === 0 && (
          <p className="text-center py-6 text-[var(--text-secondary)]">
            No surplus items found.
          </p>
        )}
      </div>
    </div>
  );
}