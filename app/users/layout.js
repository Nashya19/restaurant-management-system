/**
 * /app/users/layout.js
 * 
 * Wrapper layout for all user management pages
 * Provides:
 * - Admin authentication guard (redirects non-admins)
 * - Sidebar navigation (Users > Staff, Settings, etc.)
 * - Dark theme (globals.md compliance)
 * - Responsive grid layout
 * 
 * DESIGN DECISION: Sidebar always visible on desktop; hamburger on mobile.
 * Using Tailwind responsive classes (hidden md:block) for simplicity vs. external menu library.
 */

'use client';

import { useAdminAuth, AdminGuard } from '@/lib/hooks/useAdminAuth';
import Link from 'next/link';
import { Users, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { AdminNavBar } from '@/lib/components/AdminNavBar';

export default function UsersLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminGuard>
      <div className="dark flex min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? 'fixed' : 'hidden md:flex'
        } flex-col w-64 bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-300 z-50`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Users size={24} className="text-[var(--accent)]" />
              <h2 className="text-heading text-[var(--text-primary)]">Staff</h2>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 overflow-y-auto py-4">
            <Link
              href="/users"
              className="nav-item flex items-center gap-3 px-6 py-3 text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <Users size={18} />
              <span className="text-body">All Staff</span>
            </Link>
            <Link
              href="/users/new"
              className="nav-item flex items-center gap-3 px-6 py-3 text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="text-body">+ Create Staff</span>
            </Link>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-[var(--border)]">
            <p className="text-small text-[var(--text-muted)]">Admin Panel</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top Bar (Mobile only) */}
          <div className="md:hidden flex items-center justify-between p-4 bg-[var(--surface)] border-b border-[var(--border)]">
            <h1 className="text-heading">Users</h1>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Menu size={24} />
            </button>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AdminNavBar title="User Management" subtitle="Manage staff accounts and user access from one place." />
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
