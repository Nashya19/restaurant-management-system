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

  const [devRole, setDevRole] = useState('admin');
  const [tableNum, setTableNum] = useState('1');
  const [toast, setToast] = useState(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
    setDevRole(localStorage.getItem('dev-role') || 'admin');
    setTableNum(localStorage.getItem('tableNumber') || '1');
    if (typeof window !== 'undefined') {
      setIsLocalhost(
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1'
      );
    }
  }, []);

  useEffect(() => {
    if (devRole === 'customer') return;

    const sessionSubscription = supabase
      .channel('navbar_table_sessions')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_sessions' },
        async (payload) => {
          if (payload.new && payload.new.status === 'completed') {
            try {
              const { data: tbl } = await supabase
                .from('tables')
                .select('table_number')
                .eq('id', payload.new.table_id)
                .single();
              if (tbl) {
                setToast({
                  message: `Table ${tbl.table_number} ended ordering and is proceeding to pay!`,
                  sessionId: payload.new.id
                });
                // Auto-dismiss toast after 15 seconds
                setTimeout(() => {
                  setToast(prev => prev?.sessionId === payload.new.id ? null : prev);
                }, 15000);
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      sessionSubscription.unsubscribe();
    };
  }, [supabase, devRole]);

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

  const getNavLinks = () => {
    if (devRole === 'customer') {
      return [
        { href: '/menu', label: 'Menu', icon: ListChecks },
        { href: `/table/${tableNum}/order`, label: 'Order', icon: Grid3x3 },
      ];
    } else if (devRole === 'staff') {
      return [
        { href: '/tables', label: 'Tables', icon: Grid3x3 },
        { href: '/orders', label: 'Order Management', icon: Shield },
        { href: '/menu', label: 'Menu', icon: ListChecks },
      ];
    } else {
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/tables', label: 'Tables', icon: Grid3x3 },
        { href: '/orders', label: 'Order Management', icon: Shield },
        { href: '/users', label: 'Users', icon: Users },
        { href: '/menu', label: 'Menu', icon: ListChecks },
      ];
    }
  };

  const navLinks = getNavLinks();

  const displayTitle = devRole === 'customer' ? 'Order' : (devRole === 'staff' ? 'Order Management' : title);
  const displaySubtitle = devRole === 'customer' ? 'View your table session and order details.' : subtitle;

  return (
    <>
      {/* Top Banner Notification for ended ordering */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[100] bg-zinc-950/95 border border-[var(--accent)] px-4 py-3.5 sm:px-6 sm:py-4 shadow-2xl rounded-2xl backdrop-blur-md max-w-7xl mx-auto animate-slide-down">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <p className="font-semibold text-zinc-100">{toast.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 shrink-0">
              <button 
                onClick={() => {
                  window.location.href = `/orders?session=${toast.sessionId}`;
                  setToast(null);
                }}
                className="btn btn-primary btn-premium px-4 py-1.5 h-8 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
              >
                View Table Bill
              </button>
              <button 
                onClick={() => setToast(null)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 hover:bg-zinc-900 rounded-lg cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

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
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{displayTitle}</h3>
                {displaySubtitle && (
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {displaySubtitle}
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
          <div className="pt-6 border-t border-[#27272a] mt-auto space-y-4">
            {/* Developer Mode Switcher */}
            {isLocalhost && (
              !isCollapsed ? (
                <div className="space-y-1.5 px-4 py-3 bg-[#09090b]/40 rounded-xl border border-[#27272a]/60">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Dev Mode Role
                  </label>
                  <select
                    value={devRole}
                    onChange={(e) => {
                      localStorage.setItem('dev-role', e.target.value);
                      window.location.reload();
                    }}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-[var(--accent)] rounded-lg text-xs h-8 text-[var(--text-primary)] outline-none cursor-pointer px-2"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              ) : (
                <div className="flex justify-center py-2 bg-[#09090b]/40 rounded-xl border border-[#27272a]/60">
                  <select
                    value={devRole}
                    onChange={(e) => {
                      localStorage.setItem('dev-role', e.target.value);
                      window.location.reload();
                    }}
                    className="bg-transparent border-none rounded-lg text-xs h-8 text-[var(--text-primary)] font-bold text-center outline-none cursor-pointer w-10 px-0"
                    title="Dev Mode Role"
                  >
                    <option value="admin">A</option>
                    <option value="staff">S</option>
                    <option value="customer">C</option>
                  </select>
                </div>
              )
            )}

            {devRole !== 'customer' && (
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
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
