'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function OrdersLayout({ children }) {
  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        <AdminNavBar
          title="Order Management"
          subtitle="Real-time monitoring and state control of active table orders."
        />
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">{children}</main>
      </div>
    </AdminGuard>
  );
}
