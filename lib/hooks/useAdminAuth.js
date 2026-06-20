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

  if (!isAdmin) {
    return null; // Will be redirected by useAdminAuth
  }

  return children;
}
