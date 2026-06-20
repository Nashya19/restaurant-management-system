'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, LayoutDashboard, Users, ListChecks } from 'lucide-react';

export function AdminNavBar({ title, subtitle }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      router.push('/login');
    }
  };

  const buttonClasses =
    'inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:bg-[var(--surface)]';

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm shadow-black/5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-[var(--accent)] mb-2">
            <LayoutDashboard size={20} />
            <h2 className="text-heading">{title}</h2>
          </div>
          {subtitle && <p className="text-body text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className={buttonClasses}>
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
          <Link href="/users" className={buttonClasses}>
            <Users size={16} />
            User Management
          </Link>
          <Link href="/menu" className={buttonClasses}>
            <ListChecks size={16} />
            Menu Management
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className={`${buttonClasses} border-[var(--destructive-border)] text-[var(--destructive)] hover:border-[var(--destructive)]`}>
            <LogOut size={16} />
            {isSigningOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
