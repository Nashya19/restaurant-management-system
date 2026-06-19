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
      .select('id, full_name, email, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // TODO: fetch email from auth.users table once Supabase admin API available
    // For now, profiles table needs email column (or separate RLS-protected view)

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
 * Create new user (admin only)
 * 
 * FLOW:
 * 1. Admin calls supabase.auth.admin.createUser()
 *    - Creates entry in auth.users table
 *    - Sends invite email to new staff member
 *    - Returns { user: { id, email, ... } }
 * 
 * 2. Admin then calls this function which:
 *    - INSERT into profiles (id, full_name, role)
 *    - Creates the restaurant-specific profile
 * 
 * 3. New staff member:
 *    - Receives email with confirmation link
 *    - Clicks link to set password
 *    - Can then sign in with email + password
 * 
 * WHY two-step?
 * - Separation of concerns: auth layer (Supabase) and business layer (profiles)
 * - If profiles INSERT fails, we have orphaned auth.users entry (acceptable; can be cleaned)
 * - If we didn't create auth.users, staffmember has no way to log in
 * 
 * ERROR: If email already exists in auth.users, Supabase returns 400
 * We let it bubble up; UI shows "Email already in use"
 */
export async function createUser({ email, fullName, role }) {
  const supabase = createClient();

  try {
    // Step 1: Create auth user
    // This is a privileged operation; only works with admin session
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      throw new Error(handleSupabaseError(authError, 'Failed to create user'));
    }

    // Step 2: Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          full_name: fullName,
          role,
        },
      ])
      .select()
      .single();

    if (profileError) {
      // Profile creation failed; auth user created but profile missing
      console.error('Profile creation failed after auth user created:', profileError);
      throw new Error(handleSupabaseError(profileError, 'Failed to create user profile'));
    }

    return profile;
  } catch (err) {
    throw err;
  }
}

/**
 * Update user profile (name, role)
 * Used by /app/users/[id] page edit form
 * 
 * NOTE: Email cannot be updated here (requires auth API)
 * PASSWORD reset is separate function (resetUserPassword)
 */
export async function updateUser(userId, { fullName, role }) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update user'));
    }

    assertDataReturned(data, 'Updated user');
    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Delete user (admin only)
 * 
 * CASCADE: Deleting from profiles triggers CASCADE DELETE on auth.users
 * (due to FK constraint: id REFERENCES auth.users(id) ON DELETE CASCADE)
 * 
 * So deleting the profile automatically deletes the auth user.
 * This orphans any related data (orders, shifts, etc.) but that's acceptable
 * for internship scope; production might archive instead.
 */
export async function deleteUser(userId) {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to delete user'));
    }

    return true;
  } catch (err) {
    throw err;
  }
}

/**
 * Reset user password (admin only)
 * 
 * WHY admin API?
 * - Authenticated users use supabase.auth.updateUser({ password: newPw })
 * - Admins resetting staff passwords use admin.updateUserById()
 * - This is a privileged action; only admin can reset others' passwords
 * 
 * EMAIL: Supabase sends "password changed" email to user
 * USER EXPERIENCE: Admin gives new temp password in UI, staff logs in and should change it
 * (This is not implemented in internship scope; staff forced to use admin-given password)
 */
export async function resetUserPassword(userId, newPassword) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true, // Ensure user is marked as confirmed
    });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to reset password'));
    }

    return data.user;
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
