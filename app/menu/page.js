'use client';

import { useMemo } from 'react';

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] px-6 py-8">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm shadow-black/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-display text-[var(--text-primary)]">Menu Management</h1>
              <p className="text-body text-[var(--text-secondary)] max-w-2xl">
                Create, update, and organize menu items with ease.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
