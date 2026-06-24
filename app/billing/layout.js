/**
 * /app/billing/layout.js
 *
 * Wrapper layout for the Billing & Payments module.
 * Admin-only access via AdminGuard.
 */

'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function BillingLayout({ children }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        {/* Main Admin Sidebar */}
        <AdminNavBar
          title="Billing"
          subtitle="Process payments, view pending bills, and review revenue history."
        />

        {/* Content Page area */}
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
