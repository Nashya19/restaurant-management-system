'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, LayoutDashboard, Users, ListChecks, Grid3x3, ClipboardList, Menu, X, ChevronLeft, ChevronRight, Calendar, Sun, Moon, ReceiptText, Utensils, Heart } from 'lucide-react';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';

export const LogoIcon = ({ size = 24, className = '' }) => (
  <img
    src="/images/logo.png"
    alt="Sauté Logo"
    width={size}
    height={size}
    className={`shrink-0 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.45)] ${className}`}
  />
);

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
  const [theme, setTheme] = useState('light');
  const [userProfile, setUserProfile] = useState(null);

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
      // Theme initialization
      const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      setTheme(activeTheme);

      // Listen for theme mutations dynamically
      const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
      return () => observer.disconnect();
    }
  }, []);


  useKeyboardShortcuts(devRole !== 'customer');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            setUserProfile(profile);
          }
        }
      } catch (err) {
        console.error('Error fetching profile for navbar:', err);
      }
    };
    fetchProfile();
  }, [supabase, devRole]);

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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
        { href: '/kitchen', label: 'Kitchen Display', icon: Utensils },
        { href: '/tables', label: 'Tables', icon: Grid3x3 },
        { href: '/orders', label: 'Order Management', icon: ClipboardList },
        { href: '/schedule', label: 'Schedule', icon: Calendar },
        { href: '/menu', label: 'Menu', icon: ListChecks },
        { href: '/surplus', label: 'Surplus Management', icon: Heart },
      ];
    } else {
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/kitchen', label: 'Kitchen Display', icon: Utensils },
        { href: '/tables', label: 'Tables', icon: Grid3x3 },
        { href: '/orders', label: 'Order Management', icon: ClipboardList },
        { href: '/billing', label: 'Billing', icon: ReceiptText },
        { href: '/schedule', label: 'Schedule', icon: Calendar },
        { href: '/users', label: 'Users', icon: Users },
        { href: '/menu', label: 'Menu', icon: ListChecks },
        { href: '/surplus', label: 'Surplus Management', icon: Heart },
      ];
    }
  };

  const navLinks = getNavLinks();

  const displayTitle = devRole === 'customer' ? 'Order' : (devRole === 'staff' ? 'Order Management' : title);
  const displaySubtitle = devRole === 'customer' ? 'View your table session and order details.' : subtitle;

  if (devRole === 'customer') {
    return (
      <>
        {/* Mobile Top Header (No Hamburger Menu Button) */}
        <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border w-full z-40">
          <div className="flex items-center text-[var(--accent)]">
            <img 
              src={theme === 'dark' ? '/images/logo-text-darkmode.png' : '/images/logo-text-lightmode.png'} 
              alt="Sauté" 
              className="h-8 w-auto object-contain" 
            />
          </div>
          <span className="px-3 py-1 rounded-full bg-background border border-border text-xs font-black text-[var(--text-secondary)]">
            Table {typeof window !== 'undefined' ? localStorage.getItem('tableNumber') : ''}
          </span>
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-md border-t border-border flex items-center justify-around px-6 z-40">
          <Link
            href="/menu"
            className={`flex flex-col items-center justify-center gap-1.5 flex-1 h-full border-t-2 transition-all cursor-pointer no-underline ${
              pathname === '/menu'
                ? 'border-[var(--accent)] text-[var(--accent)] font-bold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Utensils size={18} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Menu</span>
          </Link>
          <Link
            href={`/table/${typeof window !== 'undefined' ? localStorage.getItem('tableNumber') || '' : ''}/order`}
            className={`flex flex-col items-center justify-center gap-1.5 flex-1 h-full border-t-2 transition-all cursor-pointer no-underline ${
              pathname.includes('/order')
                ? 'border-[var(--accent)] text-[var(--accent)] font-bold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ClipboardList size={18} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Orders</span>
          </Link>
        </div>

        {/* Desktop Sidebar (cleaned up for customer) */}
        <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border p-6 shrink-0 z-40 transition-all duration-300">
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-8">
              {/* Logo */}
              <div className="flex justify-center border-b border-border pb-6">
                <img 
                  src={theme === 'dark' ? '/images/logo-text-darkmode.png' : '/images/logo-text-lightmode.png'}
                  alt="Sauté" 
                  className="h-16 w-auto object-contain" 
                />
              </div>

              {/* Navigation links */}
              <nav className="flex flex-col gap-2">
                <Link
                  href="/menu"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all no-underline ${
                    pathname === '/menu'
                      ? 'bg-[var(--accent)] text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-background/50'
                  }`}
                >
                  <Utensils size={18} />
                  <span>Menu</span>
                </Link>
                <Link
                  href={`/table/${typeof window !== 'undefined' ? localStorage.getItem('tableNumber') || '' : ''}/order`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all no-underline ${
                    pathname.includes('/order')
                      ? 'bg-[var(--accent)] text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-background/50'
                  }`}
                >
                  <ClipboardList size={18} />
                  <span>Orders</span>
                </Link>
              </nav>
            </div>

            {/* Bottom Actions: Theme Toggle */}
            <div className="space-y-4">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-background/50 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              >
                <span>Theme Mode</span>
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        </aside>
      </>
    );
  }

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
      <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border w-full z-40">
        <div className="flex items-center text-[var(--accent)]">
          <img 
            src={theme === 'dark' ? '/images/logo-text-darkmode.png' : '/images/logo-text-lightmode.png'} 
            alt="Sauté" 
            className="h-9 w-auto object-contain" 
          />
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-border rounded-lg bg-background"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar navigation container */}
      <aside className={`${
        isOpen ? 'flex fixed inset-0 top-[57px] bg-background/95 backdrop-blur-md' : 'hidden'
      } md:flex flex-col w-full ${
        isCollapsed ? 'md:w-20 md:p-4' : 'md:w-64 md:p-6'
      } bg-surface border-b md:border-b-0 md:border-r border-border p-6 shrink-0 z-40 transition-all duration-300`}>
        <div className="flex flex-col h-full justify-between">
          <div className="space-y-8">
            {/* Logo and App Title */}
            <div className="relative hidden md:flex items-center justify-between text-[var(--accent)] gap-3 w-full">
              <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-center flex-1'}`}>
                {isCollapsed ? (
                  <LogoIcon size={36} className="shrink-0" />
                ) : (
                  <img 
                    src={theme === 'dark' ? '/images/logo-text-darkmode.png' : '/images/logo-text-lightmode.png'}
                    alt="Sauté" 
                    className="h-20 w-auto object-contain" 
                  />
                )}
              </div>
            </div>

            {/* Expand button (visible only when collapsed) */}
            {isCollapsed && (
              <div className="hidden md:flex justify-center border-b border-border pb-4">
                <button
                  onClick={toggleCollapse}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-background rounded-lg cursor-pointer border border-border transition-all"
                  title="Expand Sidebar"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Page specific Header (shown in sidebar) */}
            {!isCollapsed && (
              <div className="flex items-start justify-between gap-3 py-3 border-b border-border">
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{displayTitle}</h3>
                  {displaySubtitle && (
                    <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                      {displaySubtitle}
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleCollapse}
                  className="hidden md:block p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-background rounded-lg cursor-pointer border border-border transition-all shrink-0 mt-0.5"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            )}

            {/* Navigation links */}
            <nav className="flex flex-col gap-2">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                
                // Get hotkey string based on path
                let hotkeyHint = null;
                if (href === '/dashboard') hotkeyHint = 'Ctrl+D';
                else if (href === '/kitchen') hotkeyHint = 'Ctrl+K';
                else if (href === '/tables') hotkeyHint = 'Ctrl+T';
                else if (href === '/orders') hotkeyHint = 'Ctrl+O';
                else if (href === '/menu') hotkeyHint = 'Ctrl+M';
                else if (href === '/schedule') hotkeyHint = 'Ctrl+S';

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-3 ${
                      isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
                    } text-sm font-semibold rounded-xl border transition-all duration-200 ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)] shadow-md shadow-[var(--accent)]/5'
                        : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-border hover:bg-background hover:text-[var(--text-primary)]'
                    }`}
                    title={isCollapsed ? (hotkeyHint ? `${label} (${hotkeyHint})` : label) : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!isCollapsed && <span className="truncate flex-1">{label}</span>}
                    {!isCollapsed && hotkeyHint && (
                      <span className="hidden xl:inline-flex items-center justify-center text-[9px] font-mono font-bold tracking-tighter px-1.5 py-0.5 rounded border border-border/60 bg-background/50 text-[var(--text-muted)] shrink-0 group-hover:border-border group-hover:text-[var(--text-secondary)] transition-colors">
                        {hotkeyHint}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t border-border mt-auto space-y-4">
            {/* User Profile Section */}
            {userProfile && devRole !== 'customer' && (
              <div className={`flex items-center gap-3 border border-border/80 bg-background/30 rounded-xl transition-all ${
                isCollapsed ? 'justify-center p-2' : 'p-3'
              }`}
              title={isCollapsed ? `${userProfile.full_name} (${userProfile.role.toUpperCase()})` : undefined}>
                <div className={`relative flex items-center justify-center shrink-0 w-8.5 h-8.5 rounded-full font-bold text-xs select-none ${
                  userProfile.role === 'admin' 
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' 
                    : 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'
                }`}>
                  {userProfile.full_name ? userProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                    userProfile.role === 'admin' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{userProfile.full_name}</p>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase mt-1 ${
                      userProfile.role === 'admin' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/20'
                    }`}>
                      {userProfile.role}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-full flex items-center justify-center ${
                isCollapsed ? 'px-0 py-3' : 'gap-2.5 px-4 py-3'
              } text-sm font-semibold rounded-xl border border-border bg-background text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-all duration-200 cursor-pointer`}
              title={isCollapsed ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode` : undefined}
            >
              {theme === 'dark' ? (
                <Sun size={16} className="shrink-0 text-yellow-500" />
              ) : (
                <Moon size={16} className="shrink-0 text-indigo-500" />
              )}
              {!isCollapsed && (
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              )}
            </button>

            {/* Developer Mode Switcher */}
            {isLocalhost && (
              !isCollapsed ? (
                <div className="space-y-1.5 px-4 py-3 bg-background/40 rounded-xl border border-border/60">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Dev Mode Role
                  </label>
                  <select
                    value={devRole}
                    onChange={(e) => {
                      localStorage.setItem('dev-role', e.target.value);
                      window.location.reload();
                    }}
                    className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-lg text-xs h-8 text-[var(--text-primary)] outline-none cursor-pointer px-2"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              ) : (
                <div className="flex justify-center py-2 bg-background/40 rounded-xl border border-border/60">
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
                type="button"
                onClick={handleLogout}
                className={`w-full flex items-center justify-center ${
                  isCollapsed ? 'px-0 py-3' : 'gap-2.5 px-4 py-3'
                } text-sm font-semibold rounded-xl border border-destructive-border bg-destructive-bg text-destructive hover:bg-destructive hover:text-white transition-all duration-200 cursor-pointer`}
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
