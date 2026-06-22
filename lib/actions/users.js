'use server';

import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Server Action: Create new user (admin only)
 */
export async function createUser({ email, password, fullName, role, phone = null }) {
  const adminClient = createAdminClient();

  try {
    // Step 1: Create auth user directly using the service_role client
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password, // Set initial password
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      throw new Error(handleSupabaseError(authError, 'Failed to create user'));
    }

    // Step 2: Create profile record using the service role client (bypasses RLS)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          full_name: fullName,
          role,
          phone,
        },
      ])
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation failed after auth user created:', profileError);
      // Do not delete auth user; mark as orphaned in metadata for manual cleanup.
      try {
        await adminClient.auth.admin.updateUserById(authData.user.id, {
          user_metadata: { orphaned: true },
        });
      } catch (metaErr) {
        console.error('Failed to mark orphaned auth user:', metaErr);
      }
      throw new Error(handleSupabaseError(profileError, 'Failed to create user profile'));
    }

    return profile;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Update user profile (admin only)
 */
export async function updateUser(userId, { fullName, role, phone = null }) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, role, phone })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update user'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Archive user (admin only)
 */
export async function archiveUser(userId) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('profiles')
      .update({ is_archived: true })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to archive user'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function restoreUser(userId) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('profiles')
      .update({ is_archived: false })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to restore user'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Reset user password (admin only)
 */
export async function resetUserPassword(userId, newPassword) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true, // Ensure user is marked as confirmed on reset
    });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to reset password'));
    }

    return data.user;
  } catch (err) {
    throw new Error(err.message);
  }
}
