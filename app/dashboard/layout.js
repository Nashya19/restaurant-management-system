/**
 * /app/dashboard/layout.js
 * 
 * Wrapper layout for admin dashboard pages
 * Admin-only access via useAdminAuth guard
 */

'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function DashboardLayout({ children }) {
  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        {/* Main Admin Sidebar */}
        <AdminNavBar title="Dashboard" subtitle="Access the latest restaurant metrics and quick actions." />

        {/* Content Page area */}
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
