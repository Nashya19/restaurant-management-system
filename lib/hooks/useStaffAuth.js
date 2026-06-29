'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function useStaffAuth() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const devRole = localStorage.getItem('dev-role') || 'admin';
        if (devRole === 'customer') {
          setIsAuthorized(false);
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          router.push('/login');
          return;
        }

        if (!['admin', 'staff'].includes(profile.role)) {
          router.push('/login');
          return;
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error('Staff auth check failed:', err);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  return { isAuthorized, isLoading };
}

export function StaffGuard({ children }) {
  const { isAuthorized, isLoading } = useStaffAuth();
  const [devRole, setDevRole] = useState('admin');
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('dev-role') || 'admin';
      setDevRole(role);
      setPathname(window.location.pathname);
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

  if (devRole === 'customer') {
    const switchToAdmin = () => {
      localStorage.setItem('dev-role', 'admin');
      window.location.reload();
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)] p-6">
        <div className="card max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-lg text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg text-destructive text-xl">
            ️
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Access Denied</h2>
          <p className="text-sm text-[var(--text-secondary)] font-semibold">
            Kitchen display is only available for staff and admin users.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={switchToAdmin}
              className="btn btn-primary btn-premium px-4 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-[var(--accent)]/5"
            >
              Switch to Admin Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return children;
}
