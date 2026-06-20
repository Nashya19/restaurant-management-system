/**
 * Users API — Supabase Queries for Module 2: User Management
 * 
 * DESIGN DECISION: All user management queries centralized here for:
 * - Single source of truth for Supabase interaction
 * - Easier to test: mock this file in unit tests
 * - Simpler to refactor: if schema changes, update one file
 * 
 * RLS ENFORCEMENT:
 * Every query uses authenticated session; RLS policies enforce role = 'admin'.
 * If non-admin calls these functions, RLS blocks the query at database level.
 * 
 * WHY admin.createUser() and NOT supabase.auth.signUp()?
 * - signUp() is for customer self-registration; requires email verification
 * - admin.createUser() is for admin to create staff accounts; sends invite email
 * - Both create auth.users entry; we then INSERT into profiles table
 * 
 * WHY separate profiles table?
 * - Supabase auth.users contains email, last_sign_in, etc. (auth-specific)
 * - profiles contains full_name, role (restaurant-specific business logic)
 * - Clean separation of concerns; easier to extend with more profile fields later
 */

import { createClient } from '@/lib/supabase/client';
import { assertDataReturned, handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Fetch all user profiles with pagination
 * Used by /app/users page (admin list)
 * 
 * SORTING: Always by created_at DESC (newest first) so admins see recently added staff
 * PAGINATION: Optional limit + offset for large user lists (current default: no limit)
 */
export async function listUsers({ limit = null, offset = 0 } = {}) {
  const supabase = createClient();

  try {
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Note: email is stored in auth.users, not profiles.
    // Fetching email from auth.users requires admin permissions/custom views.

    if (limit) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch users'));
    }

    return { users: data || [], count };
  } catch (err) {
    throw err;
  }
}

/**
 * Fetch single user profile by ID
 * Used by /app/users/[id] page (edit form)
 */
export async function getUserById(userId) {
  const supabase = createClient();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error(handleSupabaseError(profileError, 'User not found'));
    }

    assertDataReturned(profile, 'User profile');

    // Get email from auth.users (admin API)
    // This requires admin context; currently fetched at login
    // TODO: implement admin metadata fetch

    return profile;
  } catch (err) {
    throw err;
  }
}

/**
 * Search users by name or email
 * Used by /app/users page search bar
 * 
 * SEARCH LOGIC: ILIKE (case-insensitive) on full_name
 * Email search would require joining auth.users; out of scope for now
 */
export async function searchUsers(query) {
  const supabase = createClient();

  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .ilike('full_name', searchTerm)
      .order('full_name', { ascending: true })
      .limit(20); // Limit to prevent huge result sets

    if (error) {
      throw new Error(handleSupabaseError(error, 'Search failed'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}



/**
 * Bulk update roles
 * Used by /app/users page (select multiple users, change role)
 */
export async function bulkUpdateRoles(userIds, newRole) {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .in('id', userIds);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update users'));
    }

    return true;
  } catch (err) {
    throw err;
  }
}

/**
 * Get user count (for dashboard KPI card)
 */
export async function getUserCount() {
  const supabase = createClient();

  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Failed to get user count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Error fetching user count:', err);
    return 0;
  }
}
