'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

const KITCHEN_SLOTS_KEY = 'kitchen_slots';
const DEFAULT_KITCHEN_SLOTS = 4;

/**
 * Server Action: Get current kitchen settings (e.g. kitchen_slots)
 */
export async function getKitchenSettingsAction() {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('schedule_settings')
      .select('key, value')
      .eq('key', KITCHEN_SLOTS_KEY)
      .maybeSingle();

    if (error) throw new Error(handleSupabaseError(error, 'Failed to fetch kitchen settings'));

    const slots = data?.value ? parseInt(data.value, 10) : DEFAULT_KITCHEN_SLOTS;
    return { kitchenSlots: isNaN(slots) ? DEFAULT_KITCHEN_SLOTS : Math.max(1, slots) };
  } catch (err) {
    return { kitchenSlots: DEFAULT_KITCHEN_SLOTS };
  }
}

/**
 * Server Action: Update the kitchen_slots setting
 */
export async function setKitchenSlotsAction(slots) {
  const adminClient = createAdminClient();

  const value = Math.max(1, Math.min(20, parseInt(slots, 10) || DEFAULT_KITCHEN_SLOTS));

  try {
    const { error } = await adminClient
      .from('schedule_settings')
      .upsert(
        { key: KITCHEN_SLOTS_KEY, value: String(value) },
        { onConflict: 'key' }
      );

    if (error) throw new Error(handleSupabaseError(error, 'Failed to update kitchen slots'));

    return { success: true, kitchenSlots: value };
  } catch (err) {
    throw new Error(err.message);
  }
}
