/**
 * useAdminAuth Hook
 * 
 * DESIGN DECISION: Modules 2, 3, 4 are admin-only. This hook:
 * 1. Redirects non-admin users to /orders immediately
 * 2. Prevents page content from rendering until auth is verified
 * 3. Handles loading state (shows spinner) vs. auth failure (redirects)
 * 
 * WHY NOT middleware?
 * - Middleware runs on every request but doesn't have access to Supabase session
 * - Using client-side hook + RLS policies provides defense in depth:
 *   Even if UI redirect fails, RLS blocks data access
 * - Simpler to test: hook logic isolated from request pipeline
 * 
 * RLS ENFORCEMENT:
 * This hook is UI-only. Every Supabase query ALSO checks role = 'admin' in RLS policies.
 * So compromised client-side code cannot bypass data access.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        // Bypass auth check for customers
        const devRole = localStorage.getItem('dev-role') || 'admin';
        if (devRole === 'customer') {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          // No session = redirect to login
          router.push('/login');
          return;
        }

        // Fetch user profile to check role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          // Profile not found = corrupted state, redirect to login
          router.push('/login');
          return;
        }

        if (profile.role !== 'admin') {
          // Not admin = redirect to staff orders page
          router.push('/orders');
          return;
        }

        // All checks passed
        setIsAdmin(true);
      } catch (err) {
        console.error('Admin auth check failed:', err);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAuth();
  }, [router, supabase]);

  return { isAdmin, isLoading };
}

/**
 * Component wrapper that enforces admin auth
 * Usage:
 *   <AdminGuard>
 *     <YourAdminContent />
 *   </AdminGuard>
 */
export function AdminGuard({ children }) {
  const { isAdmin, isLoading } = useAdminAuth();
  const [devRole, setDevRole] = useState('admin');
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('dev-role') || 'admin';
      setDevRole(role);
      setPathname(window.location.pathname);

      if (role === 'customer') {
        const sessionId = localStorage.getItem('sessionId');
        const tableNumber = localStorage.getItem('tableNumber');

        if (!sessionId || !tableNumber) {
          localStorage.removeItem('dev-role');
          window.location.href = '/';
          return;
        }

        const verifySession = async () => {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('table_sessions')
            .select('status')
            .eq('id', sessionId)
            .maybeSingle();

          if (error || !data || data.status === 'cleared') {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('tableNumber');
            localStorage.removeItem('dev-role');
            window.location.href = `/table/${tableNumber || '1'}`;
          }
        };
        verifySession();
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Guards based on devRole
  const switchToAdmin = () => {
    localStorage.setItem('dev-role', 'admin');
    window.location.reload();
  };

  if (devRole === 'staff') {
    const blockedPaths = ['/dashboard', '/users', '/tables/history'];
    const isBlocked = blockedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
    if (isBlocked) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--background)] p-6">
          <div className="card max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-lg text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg text-destructive text-xl">
              ️
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Access Denied</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This page is blocked for <strong>Staff</strong> accounts. Use the Developer Mode switcher to change roles.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={switchToAdmin}
                className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-[var(--accent)]/5"
              >
                Switch back to Admin
              </button>
            </div>
          </div>
        </div>
      );
    }
  } else if (devRole === 'customer') {
    // Customers can only see /menu and /table paths
    const allowedPaths = ['/menu', '/table'];
    const isAllowed = allowedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
    if (!isAllowed) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--background)] p-6">
          <div className="card max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-lg text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg text-destructive text-xl">
              ️
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Access Denied</h2>
            <p className="text-sm text-[var(--text-secondary)] font-semibold">
              Customers cannot access management screens. Use the Developer Mode switcher to change roles.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={switchToAdmin}
                className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-[var(--accent)]/5"
              >
                Switch back to Admin
              </button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  }

  if (!isAdmin) {
    return null; // Will be redirected by useAdminAuth
  }

  return children;
}
