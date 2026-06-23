/**
 * /app/menu/layout.js
 * 
 * Wrapper layout for menu management pages
 * Admin-only access via useAdminAuth guard
 */

'use client';

import { useState, useEffect } from 'react';
import { AdminGuard } from '@/lib/hooks/useAdminAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminNavBar } from '@/lib/components/AdminNavBar';
import { UtensilsCrossed } from 'lucide-react';

export default function MenuLayout({ children }) {
  const pathname = usePathname();
  const [devRole, setDevRole] = useState('admin');

  const isMenuItemsActive = pathname === '/menu';
  const isCategoriesActive = pathname === '/menu/categories';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDevRole(localStorage.getItem('dev-role') || 'admin');
    }
  }, []);

  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row">
        {/* Main Admin Sidebar */}
        <AdminNavBar title="Menu Management" subtitle="Create, update, and organize menu items with ease." />

        {/* Content Page area */}
        <main className="flex-1 flex flex-col p-6 md:p-10 md:overflow-y-auto">
          {/* Sub Navigation Bar on Top */}
          {devRole !== 'customer' && (
            <div className="flex items-center gap-3 border-b border-[#27272a] pb-4 mb-8">
              <Link
                href="/menu"
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  isMenuItemsActive
                    ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'border-[#27272a] bg-[#09090b] text-[var(--text-secondary)] hover:border-[#3f3f46] hover:text-[var(--text-primary)]'
                }`}
              >
                Menu Items
              </Link>
              <Link
                href="/menu/categories"
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  isCategoriesActive
                    ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'border-[#27272a] bg-[#09090b] text-[var(--text-secondary)] hover:border-[#3f3f46] hover:text-[var(--text-primary)]'
                }`}
              >
                Categories
              </Link>
            </div>
          )}

          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
