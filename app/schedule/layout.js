'use client';

import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function ScheduleLayout({ children }) {
  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        <AdminNavBar
          title="Staff Scheduling"
          subtitle="Manage weekly timetables, shifts, and switch requests."
        />
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">{children}</main>
      </div>
    </AdminGuard>
  );
}
