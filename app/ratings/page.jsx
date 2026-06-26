'use client';

import { useEffect, useState } from 'react';
import {
  getAverageRating,
  getRatingsList,
} from '@/lib/api/dashboard';

export default function RatingsPage() {
  const [averageRating, setAverageRating] = useState(0);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRatings = async () => {
      try {
        const avg = await getAverageRating();
        const list = await getRatingsList();

        setAverageRating(avg);
        setRatings(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadRatings();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        Loading ratings...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">
        Customer Ratings
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card bg-surface border border-border p-6 rounded-xl">
          <p className="text-sm text-[var(--text-secondary)]">
            Average Rating
          </p>

          <p className="text-4xl font-bold mt-2">
            ⭐ {averageRating.toFixed(1)} / 5
          </p>
        </div>

        <div className="stat-card bg-surface border border-border p-6 rounded-xl">
          <p className="text-sm text-[var(--text-secondary)]">
            Total Ratings
          </p>

          <p className="text-4xl font-bold mt-2">
            {ratings.length}
          </p>
        </div>
      </div>

      {/* Ratings Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4">Table ID</th>
              <th className="text-left p-4">Rating</th>
              <th className="text-left p-4">Date</th>
            </tr>
          </thead>

          <tbody>
            {ratings.map((rating) => (
              <tr
                key={rating.id}
                className="border-b border-border"
              > 
              <td className="p-4">
  Table {rating.table_sessions?.tables?.table_number || 'N/A'}
</td>
                <td className="p-4">
                  {'⭐'.repeat(rating.rating)}
                </td>

                <td className="p-4">
                  {new Date(
                    rating.created_at
                  ).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}