import { StaffGuard } from '@/lib/hooks/useStaffAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function KitchenLayout({ children }) {
  return (
    <StaffGuard>
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        <AdminNavBar
          title="Kitchen Display"
          subtitle="Live order queue, item prep status, and kitchen controls."
        />
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">{children}</main>
      </div>
    </StaffGuard>
  );
}
