"use client";

import { useEffect, useState } from "react";
import SurplusForm from "../../components/surplus/SurplusForm";
import DistributionLog from "../../components/surplus/DistributionLog";

export default function SurplusAdminPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchSurplusItems();
  }, []);

  async function fetchSurplusItems() {
    try {
      const response = await fetch("/api/surplus");
      const data = await response.json();

      setItems(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  const activeListings = items.filter(
    (item) => !item.is_claimed && item.quantity > 0
  ).length;

  const mealsShared = items.reduce(
    (total, item) => total + (item.total_given_away || 0),
    0
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Surplus Food Management
        </h1>

        <p className="text-[var(--text-secondary)] mt-2">
          Manage surplus meals and redistribute food to community partners.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-6 border border-border rounded-xl">
          <p className="text-sm text-[var(--text-secondary)]">
            Active Listings
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {activeListings}
          </h2>
        </div>

        <div className="card p-6 border border-border rounded-xl">
          <p className="text-sm text-[var(--text-secondary)]">
            Meals Shared
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {mealsShared}
          </h2>
        </div>

        <div className="card p-6 border border-border rounded-xl">
          <p className="text-sm text-[var(--text-secondary)]">
            Community Impact
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {mealsShared} Meals Shared
          </h2>
        </div>
      </div>

      <SurplusForm />

      <DistributionLog />
    </div>
  );
}