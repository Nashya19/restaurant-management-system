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
    <div className="card border border-border rounded-2xl p-6 bg-surface shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Distribution Log
        </h2>

        <span className="text-xs text-[var(--text-secondary)] font-semibold">
          Showing latest {latestItems.length} records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/80 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <th className="pb-3.5">Food Item</th>
              <th className="pb-3.5">Quantity</th>
              <th className="pb-3.5">Discount Price</th>
              <th className="pb-3.5">Pickup End</th>
              <th className="pb-3.5">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60 text-xs">
            {latestItems.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-background/20 transition-colors"
              >
                <td className="py-3.5 font-bold text-[var(--text-primary)]">
                  {item.menu_items?.name}
                </td>

                <td className="py-3.5 font-mono text-[var(--text-primary)]">
                  {item.quantity}
                </td>

                <td className="py-3.5 font-mono text-[var(--text-primary)]">
                  ₹{Number(item.discounted_price || 0).toFixed(2)}
                </td>

                <td className="py-3.5 font-mono text-[var(--text-secondary)]">
                  {new Date(item.pickup_window_end).toLocaleDateString()}
                </td>

                <td className="py-3.5">
                  {item.quantity === 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-destructive-bg border border-destructive-border text-destructive text-[10px] font-bold">
                      CLAIMED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-success-bg border border-success-border text-success text-[10px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {latestItems.length === 0 && (
          <p className="text-center py-6 text-xs text-[var(--text-muted)] font-semibold italic">
            No surplus items found.
          </p>
        )}
      </div>
    </div>
  );
}