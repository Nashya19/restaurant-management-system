'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

/**
 * Server Action: Create new shift block (Admin only)
 */
export async function createShift({ staffId, station, startTime, endTime }) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('shifts')
      .insert([
        {
          staff_id: staffId,
          station,
          start_time: startTime,
          end_time: endTime,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to create shift'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Update existing shift (Admin only)
 */
export async function updateShift(shiftId, { staffId, station, startTime, endTime }) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('shifts')
      .update({
        staff_id: staffId,
        station,
        start_time: startTime,
        end_time: endTime,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update shift'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Delete shift (Admin only)
 */
export async function deleteShift(shiftId) {
  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from('shifts')
      .delete()
      .eq('id', shiftId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to delete shift'));
    }

    return true;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Request shift switch (Staff/Admin)
 * Validates that target shift is at least 24 hours away.
 */
export async function requestShiftSwitch({ requesterShiftId, targetShiftId }) {
  const adminClient = createAdminClient();

  try {
    // 1. Get shift details to retrieve staff_ids and times
    const { data: reqShift, error: reqErr } = await adminClient
      .from('shifts')
      .select('staff_id, start_time')
      .eq('id', requesterShiftId)
      .single();

    const { data: tgtShift, error: tgtErr } = await adminClient
      .from('shifts')
      .select('staff_id, start_time')
      .eq('id', targetShiftId)
      .single();

    if (reqErr || tgtErr || !reqShift || !tgtShift) {
      throw new Error('Shifts not found');
    }

    // 2. Validate target shift is at least 24 hours away
    const targetStart = new Date(tgtShift.start_time).getTime();
    const now = Date.now();
    const diffHours = (targetStart - now) / (1000 * 60 * 60);

    if (diffHours < 24) {
      throw new Error('Switch requests are only permitted if the target shift is at least 24 hours away.');
    }

    // 3. Create the switch request
    const { data, error } = await adminClient
      .from('shift_switch_requests')
      .insert([
        {
          requester_id: reqShift.staff_id,
          target_id: tgtShift.staff_id,
          requester_shift_id: requesterShiftId,
          target_shift_id: targetShiftId,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to request shift switch'));
    }

    // 4. Broadcast notification
    try {
      await adminClient.channel('shift-notifications').send({
        type: 'broadcast',
        event: 'switch_request',
        payload: {
          type: 'switch_request',
          requesterId: reqShift.staff_id,
          targetId: tgtShift.staff_id,
          requestId: data.id,
        },
      });
    } catch (broadcastErr) {
      console.error('Failed to broadcast shift notification', broadcastErr);
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Respond to switch request (Admin only)
 * If approved, swaps the staff_ids of the two shifts.
 */
export async function respondToShiftSwitchRequest(requestId, { action }) {
  const adminClient = createAdminClient();

  try {
    if (action !== 'approved' && action !== 'rejected') {
      throw new Error('Invalid response action');
    }

    if (action === 'rejected') {
      const { data, error } = await adminClient
        .from('shift_switch_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Process approval (must swap the staff of the two shifts)
    // 1. Get the request details
    const { data: request, error: reqErr } = await adminClient
      .from('shift_switch_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      throw new Error('Switch request not found');
    }

    // 2. Perform the swap
    const { error: swapErr1 } = await adminClient
      .from('shifts')
      .update({ staff_id: request.target_id })
      .eq('id', request.requester_shift_id);

    const { error: swapErr2 } = await adminClient
      .from('shifts')
      .update({ staff_id: request.requester_id })
      .eq('id', request.target_shift_id);

    if (swapErr1 || swapErr2) {
      throw new Error('Failed to swap shift employees');
    }

    // 3. Update status to approved
    const { data, error: updateErr } = await adminClient
      .from('shift_switch_requests')
      .update({ status: 'approved' })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Set week start day (Admin only)
 */
export async function setWeekStartDay(dayIndex) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('schedule_settings')
      .upsert({ key: 'week_start_day', value: String(dayIndex) })
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update week start day'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Add day tag (holiday, end_early, open_late) (Admin only)
 */
export async function addDayTag(date, tagType, description) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('schedule_day_tags')
      .upsert({ date, tag_type: tagType, description }, { onConflict: 'date' })
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to set day tag'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Remove day tag (Admin only)
 */
export async function removeDayTag(tagId) {
  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from('schedule_day_tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to remove day tag'));
    }

    return true;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Carry over week schedule (Admin only)
 * Clones all shifts starting in source week (defined by start date)
 * to target week (offsetting by 7 days)
 */
export async function carryoverWeekSchedule(sourceWeekStart, targetWeekStart) {
  const adminClient = createAdminClient();

  try {
    const start = new Date(sourceWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    // 1. Fetch shifts from source week
    const { data: sourceShifts, error: fetchErr } = await adminClient
      .from('shifts')
      .select('*')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString());

    if (fetchErr) throw fetchErr;
    if (!sourceShifts || sourceShifts.length === 0) {
      throw new Error('No shifts found in source week to carry over.');
    }

    // Calculate time difference in ms between target start and source start
    const offsetMs = new Date(targetWeekStart).getTime() - start.getTime();

    // 2. Clone each shift and insert
    const clonedShifts = sourceShifts.map(shift => {
      const originalStart = new Date(shift.start_time).getTime();
      const originalEnd = new Date(shift.end_time).getTime();
      return {
        staff_id: shift.staff_id,
        station: shift.station,
        start_time: new Date(originalStart + offsetMs).toISOString(),
        end_time: new Date(originalEnd + offsetMs).toISOString(),
      };
    });

    const { data, error } = await adminClient
      .from('shifts')
      .insert(clonedShifts)
      .select();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to carry over schedule'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Replace all future shifts of one employee with another (Admin only)
 */
export async function replaceEmployeeShifts(oldEmployeeId, newEmployeeId, startDate) {
  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from('shifts')
      .update({ staff_id: newEmployeeId })
      .eq('staff_id', oldEmployeeId)
      .gte('start_time', startDate)
      .select();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to replace employee shifts'));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Server Action: Merge two shifts together (Admin only)
 * Sets shiftIdToKeep's start_time and end_time to newStart and newEnd,
 * and deletes shiftIdToDelete.
 */
export async function mergeShifts(shiftIdToKeep, shiftIdToDelete, newStart, newEnd) {
  const adminClient = createAdminClient();

  try {
    // 1. Update the primary shift
    const { data: updated, error: updateErr } = await adminClient
      .from('shifts')
      .update({
        start_time: newStart,
        end_time: newEnd
      })
      .eq('id', shiftIdToKeep)
      .select()
      .single();

    if (updateErr) {
      throw new Error(handleSupabaseError(updateErr, 'Failed to update primary shift during merge'));
    }

    // 2. Delete the secondary shift
    const { error: deleteErr } = await adminClient
      .from('shifts')
      .delete()
      .eq('id', shiftIdToDelete);

    if (deleteErr) {
      throw new Error(handleSupabaseError(deleteErr, 'Failed to delete merged shift'));
    }

    return updated;
  } catch (err) {
    throw new Error(err.message);
  }
}
