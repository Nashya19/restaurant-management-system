/**
 * /app/tables/layout.js
 *
 * Wrapper layout for table management pages
 * Admin-only access via useAdminAuth guard
 */

'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function TablesLayout({ children }) {
  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
        <AdminNavBar
          title="Table Management"
          subtitle="Manage physical restaurant tables, seating capacity, and QR code links."
        />
        <main className="px-6 pb-12">{children}</main>
      </div>
    </AdminGuard>
  );
}
