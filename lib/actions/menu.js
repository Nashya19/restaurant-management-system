'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Server Action: Reset all menu items availability to true
 * Used by admin/staff to perform daily menu availability resets at midnight IST.
 */
export async function resetDailyMenuItemsAvailability() {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('menu_items')
      .update({ is_available: true })
      .eq('is_available', false)
      .eq('is_archived', false)
      .select('id');

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to reset daily menu availability'));
    }

    return { success: true, count: data?.length || 0 };
  } catch (err) {
    throw new Error(err.message);
  }
}
