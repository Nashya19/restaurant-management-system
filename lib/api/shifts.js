/**
 * Shifts API — Supabase Queries for Module 8: Staff Scheduling
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Fetch all shifts within a date range (ISO strings)
 * Joins with profiles to get the staff name.
 */
export async function listShifts(startDate, endDate) {
  const supabase = createClient();

  try {
    let query = supabase
      .from('shifts')
      .select(`
        id,
        staff_id,
        station,
        start_time,
        end_time,
        created_at,
        profiles!shifts_staff_id_fkey (
          id,
          full_name,
          role
        )
      `);

    if (startDate) {
      query = query.gt('end_time', startDate);
    }
    if (endDate) {
      query = query.lt('start_time', endDate);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch shifts'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Fetch all day tags (holidays, end early, open late) within a date range
 */
export async function listDayTags(startDate, endDate) {
  const supabase = createClient();

  try {
    let query = supabase.from('schedule_day_tags').select('*');

    if (startDate) {
      query = query.gte('date', startDate.split('T')[0]);
    }
    if (endDate) {
      query = query.lte('date', endDate.split('T')[0]);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch day tags'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Fetch all schedule settings (e.g. week_start_day)
 */
export async function getScheduleSettings() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('schedule_settings')
      .select('*');

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch schedule settings'));
    }

    // Convert array of {key, value} to a key-value object
    const settings = {};
    if (data) {
      data.forEach(item => {
        settings[item.key] = item.value;
      });
    }

    return settings;
  } catch (err) {
    throw err;
  }
}

/**
 * Fetch all shift switch requests
 */
export async function listShiftSwitchRequests() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('shift_switch_requests')
      .select(`
        id,
        requester_id,
        target_id,
        requester_shift_id,
        target_shift_id,
        status,
        created_at,
        requester:profiles!shift_switch_requests_requester_id_fkey (
          id,
          full_name
        ),
        target:profiles!shift_switch_requests_target_id_fkey (
          id,
          full_name
        ),
        requester_shift:shifts!shift_switch_requests_requester_shift_id_fkey (
          id,
          station,
          start_time,
          end_time
        ),
        target_shift:shifts!shift_switch_requests_target_shift_id_fkey (
          id,
          station,
          start_time,
          end_time
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch switch requests'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}
