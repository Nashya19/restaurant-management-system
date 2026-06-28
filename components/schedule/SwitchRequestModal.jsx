'use client';

import React, { useState } from 'react';
import { X, ArrowLeftRight, Loader2, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils/formatters';

const formatStationAsLayer = (stationVal) => {
  if (!stationVal && stationVal !== 0 && stationVal !== '0') return '';
  const parsed = parseInt(stationVal, 10);
  if (!isNaN(parsed)) {
    return `Layer ${parsed + 1}`;
  }
  return stationVal;
};

export default function SwitchRequestModal({
  isOpen,
  onClose,
  mode = 'request', // 'request' or 'review'
  colleagueShift, // for 'request' mode
  userShifts = [], // for 'request' mode (requester's candidate shifts to swap)
  switchRequest, // for 'review' mode
  onSubmitRequest,
  onResolveRequest,
  isSubmitting = false,
}) {
  const [selectedUserShiftId, setSelectedUserShiftId] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserShiftId) {
      setError('Please select one of your shifts to trade.');
      return;
    }
    setError(null);
    try {
      await onSubmitRequest({
        requesterShiftId: selectedUserShiftId,
        targetShiftId: colleagueShift.id,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResolve = async (action) => {
    setError(null);
    try {
      await onResolveRequest(switchRequest.id, action);
    } catch (err) {
      setError(err.message);
    }
  };

  const checkTargetShiftAdvanceNotice = () => {
    if (!colleagueShift) return true;
    const targetStart = new Date(colleagueShift.start).getTime();
    const diffHours = (targetStart - Date.now()) / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  const isEligible = checkTargetShiftAdvanceNotice();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg bg-surface border border-border p-6 rounded-2xl shadow-2xl relative animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
        >
          <X size={20} />
        </button>

        {mode === 'request' && colleagueShift && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--accent)] border-b border-border pb-3 mb-2">
              <ArrowLeftRight size={20} />
              <h3 className="text-heading text-lg font-bold text-[var(--text-primary)]">Request Shift Switch</h3>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-xs p-3.5 rounded-xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Target Shift Details */}
            <div className="bg-background border border-border p-4 rounded-xl space-y-1">
              <span className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">Target Shift to Switch</span>
              <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">{colleagueShift.staffName}'s Shift</div>
              <div className="text-xs text-[var(--text-secondary)]">{formatStationAsLayer(colleagueShift.station)}</div>
              <div className="text-xs font-mono text-[var(--accent)]">
                {formatDate(colleagueShift.start, 'datetime')} - {formatDate(colleagueShift.end, 'time')}
              </div>
            </div>

            {!isEligible ? (
              <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-xs p-4 rounded-xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Switch Blocked</p>
                  <p className="mt-0.5">Switch requests are only allowed for shifts starting at least 24 hours in the future.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                {/* Requester Shift Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Choose one of your shifts to trade:
                  </label>
                  {userShifts.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] py-2">
                      You have no shifts scheduled this week to swap with.
                    </p>
                  ) : (
                    <select
                      value={selectedUserShiftId}
                      onChange={(e) => setSelectedUserShiftId(e.target.value)}
                      className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-3"
                    >
                      <option value="">Select a shift...</option>
                      {userShifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {formatStationAsLayer(shift.station)} | {formatDate(shift.start_time, 'datetime')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || userShifts.length === 0}
                    className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
                  >
                    {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                    <span>Submit Request</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {mode === 'review' && switchRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--accent)] border-b border-border pb-3 mb-2">
              <ArrowLeftRight size={20} />
              <h3 className="text-heading text-lg font-bold text-[var(--text-primary)]">Review Switch Request</h3>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-xs p-3.5 rounded-xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Requester Shift Details */}
              <div className="bg-background/40 border border-border/60 p-4 rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">Requester</span>
                <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  {switchRequest.requester?.full_name}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-mono text-[var(--accent)] font-semibold mt-1">
                  {formatStationAsLayer(switchRequest.requester_shift?.station)}
                </div>
                <div className="text-xs font-mono text-[var(--accent)] mt-1">
                  {formatDate(switchRequest.requester_shift?.start_time, 'datetime')} - {formatDate(switchRequest.requester_shift?.end_time, 'time')}
                </div>
              </div>

              {/* Target Shift Details */}
              <div className="bg-background/40 border border-border/60 p-4 rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">Target Staff</span>
                <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  {switchRequest.target?.full_name}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-mono text-[var(--accent)] font-semibold mt-1">
                  {formatStationAsLayer(switchRequest.target_shift?.station)}
                </div>
                <div className="text-xs font-mono text-[var(--accent)] mt-1">
                  {formatDate(switchRequest.target_shift?.start_time, 'datetime')} - {formatDate(switchRequest.target_shift?.end_time, 'time')}
                </div>
              </div>
            </div>

            {switchRequest.status === 'pending' ? (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleResolve('rejected')}
                  disabled={isSubmitting}
                  className="btn btn-danger px-4 h-10 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Reject Switch
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve('approved')}
                  disabled={isSubmitting}
                  className="btn btn-success px-4 h-10 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Approve Swap
                </button>
              </div>
            ) : (
              <div className="pt-2 text-center">
                <span
                  className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase ${
                    switchRequest.status === 'approved'
                      ? 'bg-success-bg text-success border border-success-border'
                      : 'bg-destructive-bg text-destructive border border-destructive-border'
                  }`}
                >
                  Request {switchRequest.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
