/**
 * RLS Enforcement Helper
 * 
 * DESIGN DECISION: Every query should validate RLS at client level to provide
 * immediate feedback. If RLS denies access (returns null/empty), show user-friendly error.
 * 
 * WHY BOTH client-side check AND RLS?
 * - RLS is enforcement layer (database-level security, cannot be bypassed)
 * - Client-side check is UX layer (immediate feedback, no server round-trip needed)
 * - Defense in depth: if one fails, the other catches it
 * 
 * Example:
 *   const { data, error } = await supabase
 *     .from('profiles')
 *     .select('*')
 *     .eq('role', 'admin');
 *   
 *   if (!data || data.length === 0) {
 *     throw new Error('Unauthorized access or no data returned');
 *   }
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Get current user's role from profiles table
 * Returns 'admin', 'staff', or null
 */
export async function getCurrentUserRole() {
  const supabase = createClient();

  try {
    // Get current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return null;
    }

    // Get profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    return profile.role;
  } catch (err) {
    console.error('Failed to get user role:', err);
    return null;
  }
}

/**
 * Verify that current user is admin
 * Used before sensitive operations
 */
export async function verifyAdminAccess() {
  const role = await getCurrentUserRole();
  if (role !== 'admin') {
    throw new Error('Admin access required');
  }
  return true;
}

/**
 * Handle query error and provide user-friendly message
 * RLS returns 403 Forbidden; convert to readable error
 */
export function handleSupabaseError(error, defaultMessage = 'An error occurred') {
  if (!error) return null;

  // RLS violation
  if (error.code === '403' || error.message?.includes('denied')) {
    return 'You do not have permission to perform this action.';
  }

  // Not found
  if (error.code === '404' || error.status === 404) {
    return 'Resource not found.';
  }

  // Constraint violation (e.g., duplicate key)
  if (error.code === '23505') {
    return 'This record already exists.';
  }

  // Foreign key constraint
  if (error.code === '23503') {
    return 'Cannot delete: other records depend on this item.';
  }

  // Generic message
  return error.message || defaultMessage;
}

/**
 * Verify data returned from query is non-empty
 * RLS might return empty array instead of error
 */
export function assertDataReturned(data, context = 'Data') {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error(`${context} not found or access denied.`);
  }
  return data;
}
