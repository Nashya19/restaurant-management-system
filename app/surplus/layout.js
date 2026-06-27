'use client';

import { useState, useEffect } from 'react';
import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import { AdminNavBar } from '@/lib/components/AdminNavBar';
import { createClient } from '@/lib/supabase/client';

export default function SurplusLayout({ children }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function determineRole() {
      try {
        const devRole = localStorage.getItem('dev-role');
        if (devRole === 'customer') {
          setRole('customer');
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setRole('public');
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'admin') {
          setRole('admin');
        } else if (profile?.role === 'staff') {
          setRole('staff');
        } else {
          setRole('public');
        }
      } catch (err) {
        setRole('public');
      } finally {
        setLoading(false);
      }
    }
    determineRole();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading…</p>
        </div>
      </div>
    );
  }

  // Admin/Staff see the full sidebar layout
  if (role === 'admin' || role === 'staff') {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
          <AdminNavBar
            title="Surplus Management"
            subtitle="Manage surplus meals and redistribute food to community partners."
          />
          <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">{children}</main>
        </div>
      </AdminGuard>
    );
  }

  // Public/Customer see the full-width board with a simple container
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <main className="max-w-7xl mx-auto p-6 md:p-10">{children}</main>
    </div>
  );
}

