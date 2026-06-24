/**
 * /app/users/layout.js
 * 
 * Wrapper layout for all user management pages
 */

'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function UsersLayout({ children }) {
  const pathname = usePathname();

  const isAllStaffActive = pathname === '/users';
  const isCreateStaffActive = pathname === '/users/new';

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        {/* Main Admin Sidebar */}
        <AdminNavBar title="User Management" subtitle="Manage staff accounts and user access from one place." />

        {/* Content Page area */}
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">
          {/* Sub Navigation Bar on Top */}
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-8">
            <Link
              href="/users"
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                isAllStaffActive
                  ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                  : 'border-border bg-background text-[var(--text-secondary)] hover:border-border hover:text-[var(--text-primary)]'
              }`}
            >
              All Staff
            </Link>
            <Link
              href="/users/new"
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                isCreateStaffActive
                  ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                  : 'border-border bg-background text-[var(--text-secondary)] hover:border-border hover:text-[var(--text-primary)]'
              }`}
            >
              + Create Staff
            </Link>
          </div>

          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
