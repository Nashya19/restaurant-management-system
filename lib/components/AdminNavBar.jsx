'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, LayoutDashboard, Users, ListChecks, Grid3x3, Shield, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminNavBar({ title, subtitle }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

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

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/tables', label: 'Tables', icon: Grid3x3 },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/menu', label: 'Menu', icon: ListChecks },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#18181b] border-b border-[#27272a] w-full z-40">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Shield size={20} />
          <span className="font-bold text-sm text-[var(--text-primary)]">Zenith RMS</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[#27272a] rounded-lg bg-[#09090b]"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar navigation container */}
      <aside className={`${
        isOpen ? 'flex fixed inset-0 top-[57px] bg-[#09090b]/95 backdrop-blur-md' : 'hidden'
      } md:flex flex-col w-full ${
        isCollapsed ? 'md:w-20 md:p-4' : 'md:w-64 md:p-6'
      } bg-[#18181b] border-b md:border-b-0 md:border-r border-[#27272a] p-6 shrink-0 z-40 transition-all duration-300`}>
        <div className="flex flex-col h-full justify-between">
          <div className="space-y-8">
            {/* Logo and App Title */}
            <div className="hidden md:flex items-center justify-between text-[var(--accent)]">
              <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
                <Shield size={24} className="shrink-0" />
                {!isCollapsed && (
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Zenith RMS</h2>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Operations</p>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button
                  onClick={toggleCollapse}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#09090b] rounded-lg cursor-pointer border border-[#27272a] transition-all"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>

            {/* Expand button (visible only when collapsed) */}
            {isCollapsed && (
              <div className="hidden md:flex justify-center border-b border-[#27272a] pb-4">
                <button
                  onClick={toggleCollapse}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#09090b] rounded-lg cursor-pointer border border-[#27272a] transition-all"
                  title="Expand Sidebar"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Page specific Header (shown in sidebar) */}
            {!isCollapsed && (
              <div className="space-y-1 py-3 border-b border-[#27272a]">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
                {subtitle && (
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Navigation links */}
            <nav className="flex flex-col gap-2">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center ${
                      isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
                    } text-sm font-semibold rounded-xl border transition-all duration-200 ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)] shadow-md shadow-[var(--accent)]/5'
                        : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[#27272a] hover:bg-[#09090b] hover:text-[var(--text-primary)]'
                    }`}
                    title={isCollapsed ? label : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!isCollapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Logout Action at bottom */}
          <div className="pt-6 border-t border-[#27272a] mt-auto">
            <button
              type="button; submit"
              onClick={handleLogout}
              className={`w-full flex items-center justify-center ${
                isCollapsed ? 'px-0 py-3' : 'gap-2.5 px-4 py-3'
              } text-sm font-semibold rounded-xl border border-red-950 bg-[#2a1010] text-[#c45a5a] hover:border-red-800 hover:text-red-400 transition-all duration-200 cursor-pointer`}
              title={isCollapsed ? 'Logout' : undefined}
            >
              <LogOut size={16} className="shrink-0" />
              {!isCollapsed && <span>{isSigningOut ? 'Logging out…' : 'Logout'}</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
