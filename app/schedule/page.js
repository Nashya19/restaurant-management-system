'use client';

import './schedule.css';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listUsers } from '@/lib/api/users';
import {
  listShifts,
  listDayTags,
  getScheduleSettings,
  listShiftSwitchRequests,
} from '@/lib/api/shifts';
import {
  createShift,
  updateShift,
  deleteShift,
  requestShiftSwitch,
  respondToShiftSwitchRequest,
  setWeekStartDay,
  addDayTag,
  removeDayTag,
  carryoverWeekSchedule,
  replaceEmployeeShifts,
  mergeShifts,
} from '@/lib/actions/shifts';
import ScheduleCalendar from '@/components/schedule/ScheduleCalendar';
import SwitchRequestModal from '@/components/schedule/SwitchRequestModal';
import SearchableSelect from '@/components/schedule/SearchableSelect';
import CustomDatePicker from '@/components/schedule/CustomDatePicker';
import { useAlertConfirm } from '@/lib/hooks/useAlertConfirm';
import {
  Plus,
  RefreshCw,
  Calendar,
  Users,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Tag,
  UserMinus,
  CheckCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/formatters';

const toLocalDatetimeString = (utcString) => {
  if (!utcString) return '';
  const date = new Date(utcString);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const getWeekStart = (date, startDay) => {
  const d = new Date(date);
  const currentDay = d.getDay();
  let distance = currentDay - startDay;
  if (distance < 0) {
    distance += 7;
  }
  d.setDate(d.getDate() - distance);
  d.setHours(0, 0, 0, 0);
  return d;
};const formatStationAsLayer = (stationVal) => {
  if (!stationVal && stationVal !== 0 && stationVal !== '0') return 'Shift';
  const parsed = parseInt(stationVal, 10);
  if (!isNaN(parsed)) {
    return `Layer ${parsed + 1}`;
  }
  return stationVal;
};


export default function SchedulePage() {
  const supabase = createClient();
  const { showAlert, showConfirm, AlertConfirmComponent } = useAlertConfirm();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [dayTags, setDayTags] = useState([]);
  const [weekStartDay, setWeekStartDayValue] = useState(1); // 1 = Monday default
  const [switchRequests, setSwitchRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Calendar navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    return getWeekStart(new Date(), 1); // default to Monday start initially
  });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  // Selected entities for modals
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedColleagueShift, setSelectedColleagueShift] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [switchModalMode, setSwitchModalMode] = useState('request'); // 'request' or 'review'

  // Form states
  const [shiftForm, setShiftForm] = useState({
    staffId: '',
    station: 'Shift',
    startDateStr: '',
    startHour: '00',
    startMin: '00',
    endDateStr: '',
    endHour: '00',
    endMin: '00'
  });
  const [tagForm, setTagForm] = useState({ date: '', tagType: 'holiday', description: '' });
  const [replaceForm, setReplaceForm] = useState({ oldEmployeeId: '', newEmployeeId: '', startDate: '' });

  // Filtering states
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [showAdmins, setShowAdmins] = useState(true);
  const [showStaff, setShowStaff] = useState(true);

  // Tag Form Time States
  const [tagStartHour, setTagStartHour] = useState('18');
  const [tagStartMin, setTagStartMin] = useState('00');
  const [tagEndHour, setTagEndHour] = useState('10');
  const [tagEndMin, setTagEndMin] = useState('00');

  // Get current user and active user profiles
  useEffect(() => {
    const initAuth = async () => {
      try {
        const devRole = localStorage.getItem('dev-role') || 'admin';
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser(profile);
            setIsAdmin(devRole === 'admin' && profile.role === 'admin');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    initAuth();
  }, [supabase]);

  // Load all user profiles and initial schedule settings
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { users: data } = await listUsers();
        setUsers(data.filter(u => !u.is_archived));
        
        const settings = await getScheduleSettings();
        if (settings && settings.week_start_day !== undefined) {
          const val = Number(settings.week_start_day);
          setWeekStartDayValue(val);
          setCurrentWeekStart(prev => getWeekStart(prev, val));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  // Main data fetcher
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const start = new Date(currentWeekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const [shiftsData, dayTagsData, settingsData, requestsData] = await Promise.all([
        listShifts(start.toISOString(), end.toISOString()),
        listDayTags(start.toISOString(), end.toISOString()),
        getScheduleSettings(),
        listShiftSwitchRequests(),
      ]);

      setShifts(shiftsData);
      setDayTags(dayTagsData);
      setSwitchRequests(requestsData);

      if (settingsData.week_start_day !== undefined) {
        setWeekStartDayValue(Number(settingsData.week_start_day));
      }
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation helpers
  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    const startOfWeek = getWeekStart(new Date(), weekStartDay);
    setCurrentWeekStart(startOfWeek);
  };

  // Shift Mutators
  const handleAddShiftClick = async (info) => {
    if (!isAdmin) return;
    setIsActionLoading(true);
    setError(null);
    try {
      const staffId = info.staffId || users[0]?.id;
      if (!staffId) {
        throw new Error('No staff member available to assign shift.');
      }
      await createShift({
        staffId,
        station: info.station || '0',
        startTime: new Date(info.start).toISOString(),
        endTime: new Date(info.end).toISOString(),
      });
      fetchData();
      showSuccess('Shift created successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddShiftSubmit = async (e) => {
    e.preventDefault();
    setIsActionLoading(true);
    setError(null);
    try {
      const startHour = (shiftForm.startHour || '00').padStart(2, '0');
      const startMin = (shiftForm.startMin || '00').padStart(2, '0');
      const endHour = (shiftForm.endHour || '00').padStart(2, '0');
      const endMin = (shiftForm.endMin || '00').padStart(2, '0');
      // End date is always the same as start date — shifts don't span multiple days
      const dateStr = shiftForm.startDateStr;
      const startTime = new Date(`${dateStr}T${startHour}:${startMin}:00`).toISOString();
      const endTime = new Date(`${dateStr}T${endHour}:${endMin}:00`).toISOString();

      await createShift({
        staffId: shiftForm.staffId,
        station: 'Shift',
        startTime,
        endTime,
      });
      setIsAddModalOpen(false);
      fetchData();
      showSuccess('Shift created successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditShiftClick = async (shift) => {
    const currentLayer = (shift.station && !isNaN(parseInt(shift.station, 10))) ? shift.station : '0';
    
    if (shift.silent) {
      setIsActionLoading(true);
      setError(null);
      try {
        await updateShift(shift.id, {
          staffId: shift.staffId || shift.staff_id,
          station: shift.station || '0',
          startTime: new Date(shift.start).toISOString(),
          endTime: new Date(shift.end).toISOString(),
        });
        fetchData();
        showSuccess('Shift updated successfully.');
      } catch (err) {
        setError(err.message);
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    const start = new Date(shift.start || shift.start_time);
    const end = new Date(shift.end || shift.end_time);

    const startLocalDate = start.toLocaleDateString('sv-SE');
    const startHour = String(start.getHours()).padStart(2, '0');
    const startMin = String(start.getMinutes()).padStart(2, '0');

    const endLocalDate = end.toLocaleDateString('sv-SE');
    const endHour = String(end.getHours()).padStart(2, '0');
    const endMin = String(end.getMinutes()).padStart(2, '0');

    setSelectedShift(shift);
    setShiftForm({
      staffId: shift.staffId || shift.staff_id,
      station: currentLayer,
      startDateStr: startLocalDate,
      startHour,
      startMin,
      endDateStr: endLocalDate,
      endHour,
      endMin
    });
    setIsEditModalOpen(true);
  };

  const handleEditShiftSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsActionLoading(true);
    setError(null);
    try {
      const startHour = (shiftForm.startHour || '00').padStart(2, '0');
      const startMin = (shiftForm.startMin || '00').padStart(2, '0');
      const endHour = (shiftForm.endHour || '00').padStart(2, '0');
      const endMin = (shiftForm.endMin || '00').padStart(2, '0');
      // End date is always the same as start date — shifts don't span multiple days
      const dateStr = shiftForm.startDateStr;
      const startTime = new Date(`${dateStr}T${startHour}:${startMin}:00`).toISOString();
      const endTime = new Date(`${dateStr}T${endHour}:${endMin}:00`).toISOString();

      await updateShift(selectedShift.id, {
        staffId: shiftForm.staffId,
        station: shiftForm.station || '0',
        startTime,
        endTime,
      });
      setIsEditModalOpen(false);
      fetchData();
      showSuccess('Shift updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMergeShifts = async (shiftIdToKeep, shiftIdToDelete, newStart, newEnd) => {
    setIsActionLoading(true);
    setError(null);
    try {
      await mergeShifts(shiftIdToKeep, shiftIdToDelete, newStart, newEnd);
      fetchData();
      showSuccess('Shifts combined successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteShiftClick = async () => {
    if (!(await showConfirm('Are you sure you want to delete this shift?'))) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await deleteShift(selectedShift.id);
      setIsEditModalOpen(false);
      fetchData();
      showSuccess('Shift deleted successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Day Tag Mutators
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    setIsActionLoading(true);
    setError(null);
    try {
      const existingTag = dayTags.find(t => t.date === tagForm.date);
      let finalTagType = tagForm.tagType;
      let finalDescription = tagForm.description;

      if (existingTag && existingTag.tag_type !== 'holiday' && tagForm.tagType !== 'holiday') {
        const extParts = existingTag.description?.split('|') || [];
        let parsedBlocks = [];

        if (extParts.length >= 2 && extParts[0].trim() === 'multiple') {
          const blocksStr = extParts[1] || '';
          const items = blocksStr.split(',').map(item => item.trim());
          parsedBlocks = items.map(item => {
            const idx = item.indexOf(':');
            return {
              reason: item.substring(0, idx).trim(),
              range: item.substring(idx + 1).trim(),
              type: item.includes('00:00-') ? 'open_late' : 'end_early'
            };
          });
        } else {
          let reason = extParts[0]?.trim() || '';
          let range = '';
          if (existingTag.tag_type === 'end_early') {
            const start = extParts.length >= 3 ? extParts[1].trim() : '18:00';
            const end = extParts.length >= 3 ? extParts[2].trim() : '24:00';
            range = `${start}-${end}`;
          } else {
            const start = extParts.length >= 3 ? extParts[1].trim() : '00:00';
            const end = extParts.length >= 3 ? extParts[2].trim() : '10:00';
            range = `${start}-${end}`;
          }
          parsedBlocks = [{
            reason,
            range,
            type: existingTag.tag_type
          }];
        }

        let newRange = '';
        if (tagForm.tagType === 'end_early') {
          const sh = (tagStartHour || '18').padStart(2, '0');
          const sm = (tagStartMin || '00').padStart(2, '0');
          newRange = `${sh}:${sm}-24:00`;
        } else {
          const eh = (tagEndHour || '10').padStart(2, '0');
          const em = (tagEndMin || '00').padStart(2, '0');
          newRange = `00:00-${eh}:${em}`;
        }

        const newBlock = {
          reason: tagForm.description,
          range: newRange,
          type: tagForm.tagType
        };

        const otherBlocks = parsedBlocks.filter(b => b.type !== tagForm.tagType);
        const combinedBlocks = [...otherBlocks, newBlock];
        const blockStrings = combinedBlocks.map(b => `${b.reason}:${b.range}`);

        finalTagType = existingTag.tag_type;
        finalDescription = `multiple | ${blockStrings.join(', ')}`;
      } else {
        if (tagForm.tagType === 'end_early') {
          const sh = (tagStartHour || '18').padStart(2, '0');
          const sm = (tagStartMin || '00').padStart(2, '0');
          finalDescription = `${tagForm.description} | ${sh}:${sm} | 24:00`;
        } else if (tagForm.tagType === 'open_late') {
          const eh = (tagEndHour || '10').padStart(2, '0');
          const em = (tagEndMin || '00').padStart(2, '0');
          finalDescription = `${tagForm.description} | 00:00 | ${eh}:${em}`;
        }
      }

      await addDayTag(tagForm.date, finalTagType, finalDescription);
      setIsTagModalOpen(false);
      setTagForm({ date: '', tagType: 'holiday', description: '' });
      setTagStartHour('18');
      setTagStartMin('00');
      setTagEndHour('10');
      setTagEndMin('00');
      fetchData();
      showSuccess('Day tag applied successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (!(await showConfirm('Remove this day tag?'))) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await removeDayTag(tagId);
      fetchData();
      showSuccess('Day tag removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Carryover
  const handleCarryover = async () => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    if (
      !(await showConfirm(
        `Carry over all shifts from this week to the next week (starting ${nextWeek.toLocaleDateString()})?`
      ))
    ) {
      return;
    }
    setIsActionLoading(true);
    setError(null);
    try {
      await carryoverWeekSchedule(currentWeekStart.toISOString(), nextWeek.toISOString());
      showSuccess('Schedule successfully carried over to the next week.');
      // Automatically navigate to next week to show changes
      setCurrentWeekStart(nextWeek);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Replace Employee
  const handleReplaceEmployee = async (e) => {
    e.preventDefault();
    if (!replaceForm.oldEmployeeId || !replaceForm.newEmployeeId || !replaceForm.startDate) {
      setError('Please fill in all replacement fields.');
      return;
    }
    if (
      !(await showConfirm(
        'Are you sure you want to transfer all upcoming shifts from the old employee to the new employee?'
      ))
    ) {
      return;
    }
    setIsActionLoading(true);
    setError(null);
    try {
      await replaceEmployeeShifts(
        replaceForm.oldEmployeeId,
        replaceForm.newEmployeeId,
        new Date(replaceForm.startDate).toISOString()
      );
      setIsReplaceModalOpen(false);
      setReplaceForm({ oldEmployeeId: '', newEmployeeId: '', startDate: '' });
      fetchData();
      showSuccess('Employee shifts transferred successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Shift Swap Requests
  const handleSelectColleagueShift = (shift) => {
    setSelectedColleagueShift(shift);
    setSwitchModalMode('request');
    setIsSwitchModalOpen(true);
  };

  const handleReviewRequestClick = (request) => {
    setSelectedRequest(request);
    setSwitchModalMode('review');
    setIsSwitchModalOpen(true);
  };

  const handleSubmitSwapRequest = async (payload) => {
    setIsActionLoading(true);
    try {
      await requestShiftSwitch(payload);
      setIsSwitchModalOpen(false);
      fetchData();
      showSuccess('Shift switch request submitted successfully.');
    } catch (err) {
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResolveSwapRequest = async (requestId, action) => {
    setIsActionLoading(true);
    try {
      await respondToShiftSwitchRequest(requestId, { action });
      setIsSwitchModalOpen(false);
      fetchData();
      showSuccess(`Shift swap request successfully ${action}.`);
    } catch (err) {
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleWeekStartDayChange = async (e) => {
    const val = Number(e.target.value);
    setIsActionLoading(true);
    setError(null);
    try {
      await setWeekStartDay(val);
      setWeekStartDayValue(val);
      showSuccess(`Calendar week start day updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Filters candidates for current user to trade
  const currentUserShifts = useMemo(() => {
    if (!currentUser) return [];
    return shifts.filter(s => s.staff_id === currentUser.id);
  }, [shifts, currentUser]);

  const activeSwaps = useMemo(() => {
    return switchRequests.filter(req => req.status === 'pending');
  }, [switchRequests]);

  const pastSwaps = useMemo(() => {
    return switchRequests.filter(req => req.status !== 'pending');
  }, [switchRequests]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 bg-success-bg border border-[#2a5c3a] text-success text-sm p-4 rounded-xl">
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Timetable Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-border">
        {/* Left: Date Range & Nav buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevWeek}
            className="p-2 border border-border hover:border-border bg-background rounded-xl hover:text-[var(--accent)] transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="w-56 font-mono">
            <CustomDatePicker
              label="W/C:"
              selectionMode="week"
              weekStartDay={weekStartDay}
              value={currentWeekStart.toLocaleDateString('sv-SE')}
              onChange={(newDateStr) => {
                const pickedDate = new Date(newDateStr + 'T00:00:00');
                const startOfWeek = getWeekStart(pickedDate, weekStartDay);
                setCurrentWeekStart(startOfWeek);
              }}
            />
          </div>
          <button
            onClick={handleNextWeek}
            className="p-2 border border-border hover:border-border bg-background rounded-xl hover:text-[var(--accent)] transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleCurrentWeek}
            className="btn btn-ghost text-xs bg-background border-border hover:bg-surface px-3.5 h-9 rounded-xl font-bold cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Right: Settings and Admin Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-background/40 border border-border/60 px-3 py-1.5 rounded-xl">
              <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                Start Week:
              </label>
              <select
                value={weekStartDay}
                onChange={handleWeekStartDayChange}
                className="bg-transparent border-none text-xs text-[var(--text-primary)] font-bold outline-none cursor-pointer p-0"
              >
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          )}

          <button
            onClick={fetchData}
            className="btn btn-ghost bg-background border-border hover:bg-surface hover:text-[var(--accent)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-9"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleCarryover}
                className="btn btn-ghost bg-surface border-border hover:border-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-9"
              >
                <Copy size={13} />
                <span>Carryover Week</span>
              </button>

              <button
                onClick={() => setIsReplaceModalOpen(true)}
                className="btn btn-ghost bg-surface border-border hover:border-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-9"
              >
                <UserMinus size={13} />
                <span>Swap Employee</span>
              </button>

              <button
                onClick={() => {
                  setTagForm({ date: '', tagType: 'holiday', description: '' });
                  setIsTagModalOpen(true);
                }}
                className="btn btn-ghost bg-surface border-border hover:border-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-9"
              >
                <Tag size={13} />
                <span>Tag Day</span>
              </button>

            </>
          )}
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-surface/30 border border-border/60 px-5 py-3.5 rounded-2xl">
        {/* Search Staff */}
        <div className="flex-1 max-w-md flex items-center gap-3">
          <span className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider whitespace-nowrap">
            Search Staff:
          </span>
          <SearchableSelect
            options={users}
            value={selectedStaffIds}
            onChange={setSelectedStaffIds}
            isMulti={true}
            placeholder="Search and filter by staff..."
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">
            Filter Roles:
          </span>
          <div className="flex items-center gap-1.5 bg-background border border-border p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setShowAdmins(prev => !prev)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                showAdmins
                  ? 'bg-success-bg text-success border border-[#2a5c3a]/50'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              Admins
            </button>
            <button
              type="button"
              onClick={() => setShowStaff(prev => !prev)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                showStaff
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              Staff
            </button>
          </div>
        </div>
      </div>

      {/* Main Timetable View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={36} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <ScheduleCalendar
          shifts={shifts}
          dayTags={dayTags}
          weekStartDay={weekStartDay}
          isAdmin={isAdmin}
          currentUserId={currentUser?.id}
          onAddShift={handleAddShiftClick}
          onUpdateShift={handleEditShiftClick}
          onDeleteShift={handleDeleteShiftClick}
          onSelectColleagueShift={handleSelectColleagueShift}
          onMergeShifts={handleMergeShifts}
          pendingSwaps={activeSwaps}
          users={users}
          currentWeekStart={currentWeekStart}
          selectedStaffIds={selectedStaffIds}
          showAdmins={showAdmins}
          showStaff={showStaff}
        />
      )}

      {/* Switch Requests Panel */}
      {currentUser && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Swap Requests */}
          <div className="card bg-surface border border-border p-5 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-heading text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-b border-border pb-2">
              Pending Swap Requests ({activeSwaps.length})
            </h3>
            {activeSwaps.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] font-medium">No pending swap requests.</p>
            ) : (
              <div className="divide-y divide-border space-y-4">
                {activeSwaps.map((req) => {
                  const showResolve = isAdmin;
                  return (
                    <div key={req.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 bg-background/80 border border-border/60 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          {/* Requester Shift Info */}
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase text-[var(--accent)] font-bold tracking-wider block">Requester</span>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{req.requester?.full_name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mt-1">
                              <span className="px-1.5 py-0.5 bg-[#27272a]/60 border border-[#3f3f46]/40 rounded text-[9px] font-mono text-[var(--text-primary)] uppercase font-semibold">
                                {formatStationAsLayer(req.requester_shift?.station)}
                              </span>
                              <span className="block font-medium truncate max-w-[120px]">{formatDate(req.requester_shift?.start_time, 'datetime')}</span>
                            </div>
                          </div>

                          {/* Swap icon */}
                          <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-surface border border-border text-[var(--accent)] shadow-inner">
                            <RefreshCw size={12} className="animate-pulse" />
                          </div>

                          {/* Target Shift Info */}
                          <div className="space-y-1 text-right">
                            <span className="text-[9px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">Recipient</span>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{req.target?.full_name}</p>
                            <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-[var(--text-secondary)] mt-1">
                              <span className="block font-medium truncate max-w-[120px]">{formatDate(req.target_shift?.start_time, 'datetime')}</span>
                              <span className="px-1.5 py-0.5 bg-[#27272a]/60 border border-[#3f3f46]/40 rounded text-[9px] font-mono text-[var(--text-primary)] uppercase font-semibold">
                                {formatStationAsLayer(req.target_shift?.station)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {showResolve && (
                        <button
                          onClick={() => handleReviewRequestClick(req)}
                          className="btn btn-primary btn-premium text-[11px] font-bold px-4 h-9 rounded-xl cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5 shadow-md shadow-[var(--accent)]/5 shrink-0"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Request History */}
          <div className="card bg-surface border border-border p-5 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-heading text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-b border-border pb-2">
              Swap Request History
            </h3>
            {pastSwaps.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] font-medium">No history log.</p>
            ) : (
              <div className="divide-y divide-border/60 space-y-3.5 max-h-60 overflow-y-auto pr-1">
                {pastSwaps.map((req) => (
                  <div key={req.id} className="pt-3.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-bold text-[var(--text-primary)]">{req.requester?.full_name}</span>
                        <span className="text-[var(--text-secondary)] text-[10px]">↔</span>
                        <span className="font-bold text-[var(--text-primary)]">{req.target?.full_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                        <span className="px-1.5 py-0.5 bg-[#27272a]/60 border border-[#3f3f46]/40 rounded text-[9px] font-mono uppercase text-[var(--text-primary)] font-semibold">
                          {formatStationAsLayer(req.requester_shift?.station)}
                        </span>
                        <span className="opacity-50">&</span>
                        <span className="px-1.5 py-0.5 bg-[#27272a]/60 border border-[#3f3f46]/40 rounded text-[9px] font-mono uppercase text-[var(--text-primary)] font-semibold">
                          {formatStationAsLayer(req.target_shift?.station)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                        req.status === 'approved'
                          ? 'bg-success-bg border-[#2a5c3a]/60 text-success'
                          : 'bg-destructive-bg border-destructive-border/60 text-destructive'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Modals and Dialog Forms --- */}

      {/* Add Shift Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleAddShiftSubmit}
            className="card w-full max-w-lg bg-surface border border-border p-6 rounded-2xl shadow-2xl relative space-y-4"
          >
            <h3 className="text-heading text-lg font-bold text-[var(--text-primary)]">Create Shift</h3>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Staff Member
                </label>
                <SearchableSelect
                  options={users}
                  value={shiftForm.staffId}
                  onChange={(newVal) => setShiftForm({ ...shiftForm, staffId: newVal })}
                  placeholder="Select staff member..."
                  isMulti={false}
                />
              </div>

              {/* Single date — shifts don't span multiple days */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Date
                </label>
                <CustomDatePicker
                  value={shiftForm.startDateStr}
                  onChange={(newVal) => setShiftForm({ ...shiftForm, startDateStr: newVal })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Start Time (24h)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="HH"
                      maxLength={2}
                      value={shiftForm.startHour || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftForm({ ...shiftForm, startHour: val });
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 23) val = '23';
                          setShiftForm(prev => ({ ...prev, startHour: val }));
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                    />
                    <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                    <input
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={shiftForm.startMin || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftForm({ ...shiftForm, startMin: val });
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 59) val = '59';
                          setShiftForm(prev => ({ ...prev, startMin: val }));
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                    />
                  </div>
                </div>

                <div className="space-y-2 flex flex-col items-end">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block text-right w-full">
                    End Time (24h)
                  </label>
                  <div className="flex gap-2 justify-end">
                    <input
                      type="text"
                      placeholder="HH"
                      maxLength={2}
                      value={shiftForm.endHour || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftForm({ ...shiftForm, endHour: val });
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 23) val = '23';
                          setShiftForm(prev => ({ ...prev, endHour: val }));
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                    />
                    <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                    <input
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={shiftForm.endMin || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftForm({ ...shiftForm, endMin: val });
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 59) val = '59';
                          setShiftForm(prev => ({ ...prev, endMin: val }));
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>Create Shift</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit/Update Shift Modal */}
      {isEditModalOpen && selectedShift && (() => {
        const selectedShiftDate = new Date(selectedShift.start_time || selectedShift.start).toDateString();
        // Exclude this shift itself when computing what layers are occupied by others
        const otherDayShifts = shifts.filter(s =>
          s.id !== selectedShift.id &&
          new Date(s.start_time).toDateString() === selectedShiftDate
        );
        const maxOtherLayer = otherDayShifts.reduce((max, s) => {
          const layerVal = parseInt(s.station, 10);
          return !isNaN(layerVal) ? Math.max(max, layerVal) : max;
        }, -1);
        // Allow layers 0 .. maxOtherLayer+1 (one beyond the current top — no gaps)
        const maxLayerAllowed = maxOtherLayer + 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <form
              onSubmit={handleEditShiftSubmit}
              className="card w-full max-w-lg bg-surface border border-border p-6 rounded-2xl shadow-2xl relative space-y-4"
            >
              <h3 className="text-heading text-lg font-bold text-[var(--text-primary)]">Edit Shift</h3>
              <div className="space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                      Staff Member
                    </label>
                    <SearchableSelect
                      options={users}
                      value={shiftForm.staffId}
                      onChange={(newVal) => setShiftForm({ ...shiftForm, staffId: newVal })}
                      placeholder="Select staff member..."
                      isMulti={false}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                      Layer (Lane)
                    </label>
                    <select
                      value={shiftForm.station}
                      onChange={(e) => setShiftForm({ ...shiftForm, station: e.target.value })}
                      className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-3"
                    >
                      {Array.from({ length: maxLayerAllowed + 1 }, (_, i) => (
                        <option key={i} value={String(i)}>
                          Layer {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Single date — shifts don't span multiple days */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Date
                  </label>
                  <CustomDatePicker
                    value={shiftForm.startDateStr}
                    onChange={(newVal) => setShiftForm({ ...shiftForm, startDateStr: newVal })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                      Start Time (24h)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="HH"
                        maxLength={2}
                        value={shiftForm.startHour || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setShiftForm({ ...shiftForm, startHour: val });
                        }}
                        onBlur={(e) => {
                          let val = e.target.value;
                          if (val) {
                            val = val.padStart(2, '0');
                            const num = parseInt(val, 10);
                            if (num > 23) val = '23';
                            setShiftForm(prev => ({ ...prev, startHour: val }));
                          }
                        }}
                        className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                      />
                      <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                      <input
                        type="text"
                        placeholder="MM"
                        maxLength={2}
                        value={shiftForm.startMin || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setShiftForm({ ...shiftForm, startMin: val });
                        }}
                        onBlur={(e) => {
                          let val = e.target.value;
                          if (val) {
                            val = val.padStart(2, '0');
                            const num = parseInt(val, 10);
                            if (num > 59) val = '59';
                            setShiftForm(prev => ({ ...prev, startMin: val }));
                          }
                        }}
                        className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 flex flex-col items-end">
                    <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block text-right w-full">
                      End Time (24h)
                    </label>
                    <div className="flex gap-2 justify-end">
                      <input
                        type="text"
                        placeholder="HH"
                        maxLength={2}
                        value={shiftForm.endHour || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setShiftForm({ ...shiftForm, endHour: val });
                        }}
                        onBlur={(e) => {
                          let val = e.target.value;
                          if (val) {
                            val = val.padStart(2, '0');
                            const num = parseInt(val, 10);
                            if (num > 23) val = '23';
                            setShiftForm(prev => ({ ...prev, endHour: val }));
                          }
                        }}
                        className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                      />
                      <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                      <input
                        type="text"
                        placeholder="MM"
                        maxLength={2}
                        value={shiftForm.endMin || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setShiftForm({ ...shiftForm, endMin: val });
                        }}
                        onBlur={(e) => {
                          let val = e.target.value;
                          if (val) {
                            val = val.padStart(2, '0');
                            const num = parseInt(val, 10);
                            if (num > 59) val = '59';
                            setShiftForm(prev => ({ ...prev, endMin: val }));
                          }
                        }}
                        className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-11 text-[var(--text-primary)] outline-none px-2 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteShiftClick}
                  disabled={isActionLoading}
                  className="btn btn-danger px-4 h-10 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Delete Shift
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
                  >
                    {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Tag Day Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleTagSubmit}
            className="card w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl relative space-y-4"
          >
            <h3 className="text-heading text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Tag size={18} className="text-[var(--accent)]" />
              <span>Tag Day (Special Conditions)</span>
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Date
                </label>
                <CustomDatePicker
                  value={tagForm.date}
                  onChange={(newVal) => setTagForm({ ...tagForm, date: newVal })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Tag Type
                </label>
                <select
                  value={tagForm.tagType}
                  onChange={(e) => setTagForm({ ...tagForm, tagType: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-3"
                >
                  <option value="holiday">Holiday (Full Day Off)</option>
                  <option value="end_early">End Early</option>
                  <option value="open_late">Open Late</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Description / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Independence Day, Staff Outing"
                  value={tagForm.description}
                  onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-3"
                  required
                />
              </div>

              {tagForm.tagType === 'end_early' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    Start Time of Early Ending (24h)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="HH"
                      maxLength={2}
                      value={tagStartHour}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setTagStartHour(val);
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 23) val = '23';
                          setTagStartHour(val);
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-2 text-center font-mono"
                    />
                    <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                    <input
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={tagStartMin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setTagStartMin(val);
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 59) val = '59';
                          setTagStartMin(val);
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-2 text-center font-mono"
                    />
                  </div>
                </div>
              )}

              {tagForm.tagType === 'open_late' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                    End Time of Late Opening (24h)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="HH"
                      maxLength={2}
                      value={tagEndHour}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setTagEndHour(val);
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 23) val = '23';
                          setTagEndHour(val);
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-2 text-center font-mono"
                    />
                    <span className="flex items-center text-[var(--text-secondary)] font-bold">:</span>
                    <input
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={tagEndMin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setTagEndMin(val);
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val) {
                          val = val.padStart(2, '0');
                          const num = parseInt(val, 10);
                          if (num > 59) val = '59';
                          setTagEndMin(val);
                        }
                      }}
                      className="w-16 bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-2 text-center font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* List existing day tags in this week to delete them */}
            {dayTags.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Current tags in this view:
                </label>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {dayTags.map((tag) => {
                    const descParts = tag.description?.split('|') || [];
                    const isMultiple = descParts.length >= 2 && descParts[0]?.trim() === 'multiple';
                    let cleanDesc = '';
                    let timesText = '';
                    let tagTypeLabel = '';

                    if (isMultiple) {
                      const blocksStr = descParts[1] || '';
                      const items = blocksStr.split(',').map(item => item.trim());
                      const listItems = items.map(item => {
                        const idx = item.indexOf(':');
                        const r = item.substring(0, idx).trim();
                        const g = item.substring(idx + 1).trim();
                        const isLate = g.startsWith('00:00-');
                        return `${isLate ? 'Opens Late' : 'Ends Early'} (${r}: ${g})`;
                      });
                      cleanDesc = listItems.join(', ');
                      tagTypeLabel = 'Special Hours';
                    } else {
                      cleanDesc = descParts[0]?.trim();
                      timesText = descParts.length >= 3 ? ` (${descParts[1]?.trim()} - ${descParts[2]?.trim()})` : '';
                      tagTypeLabel = tag.tag_type === 'holiday' ? 'Holiday' : tag.tag_type === 'end_early' ? 'Ends Early' : 'Opens Late';
                    }
                    return (
                      <div key={tag.id} className="flex items-center justify-between text-xs py-1 px-2 bg-background border border-border rounded-lg">
                        <span className="truncate">
                          <span className="font-semibold text-[var(--text-secondary)] font-mono">{tag.date}</span>
                          <span className="text-[var(--text-primary)] ml-2">{tagTypeLabel}: {cleanDesc}{timesText}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="text-destructive hover:text-red-400 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>Apply Tag</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Swap/Replace Employee Modal */}
      {isReplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleReplaceEmployee}
            className="card w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl relative space-y-4"
          >
            <h3 className="text-heading text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <UserMinus size={18} className="text-[var(--accent)]" />
              <span>Swap Employee Shifts</span>
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Original Employee (Leaving)
                </label>
                <select
                  value={replaceForm.oldEmployeeId}
                  onChange={(e) => setReplaceForm({ ...replaceForm, oldEmployeeId: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-3"
                  required
                >
                  <option value="">Select original employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  New Employee (Inheriting)
                </label>
                <select
                  value={replaceForm.newEmployeeId}
                  onChange={(e) => setReplaceForm({ ...replaceForm, newEmployeeId: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl text-sm h-10 text-[var(--text-primary)] outline-none px-3"
                  required
                >
                  <option value="">Select inheriting employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider block">
                  Start From Date
                </label>
                <CustomDatePicker
                  value={replaceForm.startDate}
                  onChange={(val) => setReplaceForm({ ...replaceForm, startDate: val })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReplaceModalOpen(false)}
                className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>Swap Employee</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Switch/Swap Shift Modal for Staff/Admin clicks */}
      <SwitchRequestModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        mode={switchModalMode}
        colleagueShift={selectedColleagueShift}
        userShifts={currentUserShifts}
        switchRequest={selectedRequest}
        onSubmitRequest={handleSubmitSwapRequest}
        onResolveRequest={handleResolveSwapRequest}
        isSubmitting={isActionLoading}
      />
      {AlertConfirmComponent}
    </div>
  );
}
