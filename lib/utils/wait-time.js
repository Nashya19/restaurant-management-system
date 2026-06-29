/**
 * Wait Time Estimation Utilities
 *
 * Two-phase approach:
 *   Phase 1 (server, at order placement): computeEstimatedWait()
 *     → Uses kitchen load and max item prep time to produce an initial estimate.
 *
 *   Phase 2 (client, live countdown): computeLiveSecondsLeft()
 *     → Uses per-item item_started_at and prep_time_minutes to tick down in real time.
 */

/**
 * DEFAULT_AVG_PREP_MINUTES
 * Fallback average prep time used when an item has no prep_time_minutes set.
 */
export const DEFAULT_AVG_PREP_MINUTES = 10;

/**
 * computeEstimatedWait
 *
 * Server-side calculation at order placement time.
 *
 * @param {Array<{ prep_time_minutes?: number, quantity?: number }>} newOrderItems
 *   Items in the NEW order being placed.
 * @param {Array<{ item_status: string, prep_time_minutes?: number }>} queuedItems
 *   All pending/preparing order_items from orders placed BEFORE this one (other sessions).
 * @param {number} kitchenSlots
 *   How many items the kitchen can prep in parallel (default 4, admin-configurable).
 *
 * @returns {number} Estimated wait in whole minutes (minimum 1).
 */
export function computeEstimatedWait(newOrderItems, queuedItems, kitchenSlots = 4) {
  const slots = Math.max(1, kitchenSlots);

  // Max prep time across items in this order (parallel items cook simultaneously)
  const ourMaxPrepMins = newOrderItems.reduce((max, item) => {
    const prep = item.prep_time_minutes ?? DEFAULT_AVG_PREP_MINUTES;
    return Math.max(max, prep);
  }, DEFAULT_AVG_PREP_MINUTES);

  // Average prep time of queued items ahead of us
  const pendingItems = queuedItems.filter(i =>
    i.item_status === 'pending' || i.item_status === 'preparing'
  );

  const avgQueuedPrep = pendingItems.length > 0
    ? pendingItems.reduce((sum, i) => sum + (i.prep_time_minutes ?? DEFAULT_AVG_PREP_MINUTES), 0) / pendingItems.length
    : 0;

  // Effective number of "batches" the kitchen must process before starting ours.
  // Each batch = `kitchenSlots` items prepared simultaneously.
  const batchesBefore = Math.ceil(pendingItems.length / slots);
  const kitchenLoadBufferMins = batchesBefore * avgQueuedPrep;

  const totalMins = ourMaxPrepMins + kitchenLoadBufferMins;
  return Math.max(1, Math.round(totalMins));
}

/**
 * computeLiveSecondsLeft
 *
 * Client-side real-time calculation. Call this every second inside a setInterval.
 *
 * For each item in the order:
 *   - If `preparing` & has `item_started_at`: count down from elapsed time.
 *   - If `pending`: use full prep_time_minutes as worst-case (not started yet).
 *   - If `ready`: ignore.
 *
 * Returns the MAXIMUM seconds remaining across all non-ready items (the bottleneck).
 *
 * @param {Array<{
 *   item_status: 'pending'|'preparing'|'ready',
 *   item_started_at: string|null,
 *   prep_time_minutes?: number,
 * }>} items
 * @param {Date} [now]  Optional — defaults to new Date()
 *
 * @returns {number|null}
 *   Seconds remaining (can be negative when overdue), or null if all items are ready.
 */
export function computeLiveSecondsLeft(items, now = new Date()) {
  const activeItems = items.filter(i => i.item_status !== 'ready');
  if (activeItems.length === 0) return null; // all done

  let maxSeconds = -Infinity;

  for (const item of activeItems) {
    const prepSecs = (item.prep_time_minutes ?? DEFAULT_AVG_PREP_MINUTES) * 60;

    if (item.item_status === 'preparing' && item.item_started_at) {
      const elapsedMs = now - new Date(item.item_started_at);
      const remaining = prepSecs - Math.floor(elapsedMs / 1000);
      maxSeconds = Math.max(maxSeconds, remaining);
    } else {
      // Pending — full prep time as worst case
      maxSeconds = Math.max(maxSeconds, prepSecs);
    }
  }

  return maxSeconds === -Infinity ? null : maxSeconds;
}

/**
 * formatWaitLabel
 *
 * Human-friendly display string from seconds.
 *
 * @param {number|null} seconds
 * @param {'placed'|'preparing'|'ready'|'delivered'} [orderStatus]
 * @returns {string|null}  null means "don't show"
 */
export function formatWaitLabel(seconds, orderStatus) {
  if (orderStatus === 'delivered') return null;
  if (seconds === null) return null;

  if (seconds <= 0) {
    return orderStatus === 'preparing' ? 'Almost ready!' : null;
  }

  const totalMins = Math.ceil(seconds / 60);
  if (totalMins < 1) return 'Almost ready!';
  if (totalMins === 1) return '~1 min left';
  return `~${totalMins} min left`;
}

/**
 * formatStaticWaitLabel
 *
 * Display for the initial stored estimate (Phase 1), shown before kitchen starts.
 *
 * @param {number|null} minutes
 * @returns {string|null}
 */
export function formatStaticWaitLabel(minutes) {
  if (!minutes || minutes <= 0) return null;
  return `~${minutes} min`;
}
