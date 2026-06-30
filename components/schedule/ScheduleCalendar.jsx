'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/utils/formatters';
import { AlertCircle } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23
const TOTAL_HOURS = 24;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const getEmployeeColor = (userId, isDark) => {
  if (!userId) return { bg: 'var(--surface)', border: 'var(--border)', text: 'var(--text-primary)' };
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  if (isDark) {
    return {
      bg: `hsl(${hue}, 40%, 15%)`,
      border: `hsl(${hue}, 50%, 40%)`,
      text: `hsl(${hue}, 85%, 85%)`
    };
  } else {
    return {
      bg: `hsl(${hue}, 70%, 92%)`,
      border: `hsl(${hue}, 60%, 75%)`,
      text: `hsl(${hue}, 85%, 20%)`
    };
  }
};

const parseDayTagTimes = (dayTag) => {
  if (!dayTag) return [];
  if (dayTag.tag_type === 'holiday') {
    return [{ startTime: '00:00', endTime: '24:00', reason: dayTag.description }];
  }
  
  const parts = dayTag.description?.split('|') || [];
  if (parts.length >= 2 && parts[0].trim() === 'multiple') {
    const blocksStr = parts[1] || '';
    const items = blocksStr.split(',').map(item => item.trim());
    return items.map(item => {
      const idx = item.indexOf(':');
      const reason = item.substring(0, idx).trim();
      const range = item.substring(idx + 1).trim();
      const [start, end] = range.split('-').map(t => t.trim());
      return {
        startTime: start,
        endTime: end,
        reason: reason
      };
    });
  }

  if (parts.length >= 3) {
    return [{
      reason: parts[0].trim(),
      startTime: parts[1].trim(),
      endTime: parts[2].trim(),
    }];
  }
  
  if (dayTag.tag_type === 'end_early') {
    return [{ reason: dayTag.description, startTime: '18:00', endTime: '24:00' }];
  }
  if (dayTag.tag_type === 'open_late') {
    return [{ reason: dayTag.description, startTime: '00:00', endTime: '10:00' }];
  }
  
  return [{ reason: dayTag.description, startTime: '00:00', endTime: '24:00' }];
};

const getTagPositionStyles = (startTimeStr, endTimeStr) => {
  const parseTimeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const startDecimal = parseTimeToDecimal(startTimeStr);
  let endDecimal = endTimeStr === '24:00' ? 24.0 : parseTimeToDecimal(endTimeStr);

  const left = (startDecimal / TOTAL_HOURS) * 100;
  const width = Math.max(0, Math.min(100 - left, ((endDecimal - startDecimal) / TOTAL_HOURS) * 100));

  return {
    left: `${left}%`,
    width: `${width}%`,
    top: 0,
    bottom: 0,
  };
};

const isShiftInBlockedRange = (startStr, endStr, dayTag) => {
  if (!dayTag) return false;
  const blocks = parseDayTagTimes(dayTag);
  if (!blocks || blocks.length === 0) return false;
  
  const shiftDate = new Date(startStr);
  const tagDate = new Date(dayTag.date + 'T00:00:00');
  if (shiftDate.toDateString() !== tagDate.toDateString()) return false;
  
  const sStart = shiftDate.getHours() + shiftDate.getMinutes() / 60;
  
  const endDate = new Date(endStr);
  let sEnd = endDate.getHours() + endDate.getMinutes() / 60;
  if (endDate.getDate() !== shiftDate.getDate()) {
    sEnd = 24.0;
  }
  
  const parseTimeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };
  
  return blocks.some(block => {
    const tStart = parseTimeToDecimal(block.startTime);
    const tEnd = block.endTime === '24:00' ? 24.0 : parseTimeToDecimal(block.endTime);
    return sStart < tEnd && sEnd > tStart;
  });
};

const resolveLayerCollisions = (dayShifts) => {
  const sorted = [...dayShifts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const placedShifts = [];

  sorted.forEach((shift) => {
    let targetLayer = parseInt(shift.station, 10);
    if (isNaN(targetLayer)) {
      targetLayer = 0;
    }

    const shiftStart = new Date(shift.start_time).getTime();
    const shiftEnd = new Date(shift.end_time).getTime();

    let layer = targetLayer;
    while (true) {
      const hasOverlap = placedShifts.some((placed) => {
        if (placed.laneIndex !== layer) return false;
        const pStart = new Date(placed.start_time).getTime();
        const pEnd = new Date(placed.end_time).getTime();
        return shiftStart < pEnd && shiftEnd > pStart;
      });

      if (!hasOverlap) {
        break;
      }
      layer++;
    }

    placedShifts.push({
      ...shift,
      laneIndex: layer,
    });
  });

  const maxLane = placedShifts.reduce((max, s) => Math.max(max, s.laneIndex), 0);

  return {
    shifts: placedShifts,
    totalLanes: maxLane + 1,
  };
};

export default function ScheduleCalendar({
  shifts,
  dayTags,
  weekStartDay, // 0 = Sunday, 1 = Monday
  isAdmin,
  currentUserId,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onSelectColleagueShift,
  onMergeShifts,
  pendingSwaps = [],
  users = [], // List of active users to display in drag tray
  currentWeekStart, // Pass currently viewed week start date to do accurate date calculation
  selectedStaffIds = [],
  showAdmins = true,
  showStaff = true,
}) {
  const containerRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null); // { shiftId, type, initialX, initialStart, initialEnd, currentStart, currentEnd, collidedWith }
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [pendingMerge, setPendingMerge] = useState(null);
  const [calendarError, setCalendarError] = useState(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkTheme = () => {
        setIsDark(document.documentElement.classList.contains('dark'));
      };
      checkTheme();
      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);

  // Group users into Admins and Staff
  const { admins, staff } = React.useMemo(() => {
    const adminsList = [];
    const staffList = [];
    users.forEach((u) => {
      if (u.role === 'admin') {
        adminsList.push(u);
      } else {
        staffList.push(u);
      }
    });
    return { admins: adminsList, staff: staffList };
  }, [users]);

  // Adjust order of days based on weekStartDay
  const orderedDays = React.useMemo(() => {
    const days = [...DAY_NAMES];
    if (weekStartDay === 0) {
      const sun = days.pop();
      days.unshift(sun);
    }
    return days;
  }, [weekStartDay]);

  // Dynamic Lane Assignment with Cascading Collision Solver
  const processDayShifts = (dayName) => {
    const dayShifts = shifts.filter((shift) => {
      const date = new Date(shift.start_time);
      const options = { weekday: 'long' };
      const shiftDay = new Intl.DateTimeFormat('en-US', options).format(date);
      return shiftDay.toLowerCase() === dayName.toLowerCase();
    }).map(shift => {
      // Use live drag times if active
      if (activeDrag && activeDrag.shiftId === shift.id) {
        return {
          ...shift,
          start_time: activeDrag.currentStart,
          end_time: activeDrag.currentEnd
        };
      }
      return shift;
    });

    // Sort shifts by start_time
    const sorted = [...dayShifts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const placedShifts = [];

    sorted.forEach((shift) => {
      // Parse manual target layer (0-indexed). If invalid/NaN, start at 0
      let targetLayer = parseInt(shift.station, 10);
      if (isNaN(targetLayer)) {
        targetLayer = 0;
      }

      const shiftStart = new Date(shift.start_time).getTime();
      const shiftEnd = new Date(shift.end_time).getTime();

      let layer = targetLayer;
      while (true) {
        const hasOverlap = placedShifts.some((placed) => {
          if (placed.laneIndex !== layer) return false;
          const pStart = new Date(placed.start_time).getTime();
          const pEnd = new Date(placed.end_time).getTime();
          return shiftStart < pEnd && shiftEnd > pStart;
        });

        if (!hasOverlap) {
          break;
        }
        layer++; // Cascade to the next layer
      }

      placedShifts.push({
        ...shift,
        laneIndex: layer,
      });
    });

    // Filter placedShifts by staff members and role
    const filteredPlacedShifts = placedShifts.filter((shift) => {
      const user = users.find((u) => u.id === shift.staff_id);
      const userRole = user?.role || 'staff';

      // Role filter
      if (userRole === 'admin' && !showAdmins) return false;
      if (userRole === 'staff' && !showStaff) return false;

      // Staff multi-select filter
      if (selectedStaffIds && selectedStaffIds.length > 0) {
        if (!selectedStaffIds.includes(shift.staff_id)) return false;
      }

      return true;
    });

    // Get unique laneIndex values, sorted
    const uniqueLanes = Array.from(new Set(filteredPlacedShifts.map((s) => s.laneIndex))).sort((a, b) => a - b);

    // Map each shift's laneIndex to its index in uniqueLanes
    const uiShifts = filteredPlacedShifts.map((s) => {
      const uiLaneIndex = uniqueLanes.indexOf(s.laneIndex);
      return {
        ...s,
        uiLaneIndex,
      };
    });

    return {
      shifts: uiShifts,
      totalLanes: uniqueLanes.length,
      originalLanes: uniqueLanes,
    };
  };

  const getTagForDay = (dayName) => {
    return dayTags.find((tag) => {
      const date = new Date(tag.date + 'T00:00:00');
      const options = { weekday: 'long' };
      const tagDay = new Intl.DateTimeFormat('en-US', options).format(date);
      return tagDay.toLowerCase() === dayName.toLowerCase();
    });
  };

  // Helper to calculate left/width percentage for a shift
  const getPositionStyles = (startTimeStr, endTimeStr, shiftId, laneIndex) => {
    let start = new Date(startTimeStr);
    let end = new Date(endTimeStr);

    if (activeDrag && activeDrag.shiftId === shiftId) {
      start = new Date(activeDrag.currentStart);
      end = new Date(activeDrag.currentEnd);
    }

    const startDecimal = start.getHours() + start.getMinutes() / 60;
    
    // Calculate endDecimal taking day crossings into account
    let endDecimal = end.getHours() + end.getMinutes() / 60;
    const startDayOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDayOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const daysDiff = Math.round((endDayOnly - startDayOnly) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0) {
      endDecimal += daysDiff * 24;
    }

    const left = (startDecimal / TOTAL_HOURS) * 100;
    const width = Math.max(0, Math.min(100 - left, ((endDecimal - startDecimal) / TOTAL_HOURS) * 100));

    return {
      left: `${left}%`,
      width: `${width}%`,
      top: `${laneIndex * 48 + 12}px`, // 48px height per shift + 12px offset (6px container gap + 6px centering offset)
      height: '36px',
      boxSizing: 'border-box',
    };
  };

  // HTML5 Drag and Drop for Employee Tray
  const handleEmployeeDragStart = (e, user) => {
    if (!isAdmin) return;
    setDraggedEmployee(user);
    e.dataTransfer.setData('text/plain', user.id);
  };

  const handleDragOverTrack = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
  };

  const handleDropOnTrack = (e, dayName) => {
    if (!isAdmin || !draggedEmployee) return;
    e.preventDefault();

    const trackRect = e.currentTarget.getBoundingClientRect();
    const dropX = e.clientX - trackRect.left;
    const dropPercent = dropX / trackRect.width;
    const clickHourDecimal = dropPercent * TOTAL_HOURS;
    
    // Snap to nearest 30 mins
    const roundedHour = Math.floor(clickHourDecimal);
    const roundedMinutes = Math.round((clickHourDecimal % 1) * 2) * 30 === 60 ? 0 : Math.round((clickHourDecimal % 1) * 2) * 30;

    // Accurate date calculation relative to currentWeekStart
    const dayOfWeekIndex = orderedDays.indexOf(dayName);
    const targetDate = new Date(currentWeekStart);
    targetDate.setDate(targetDate.getDate() + dayOfWeekIndex);
    targetDate.setHours(roundedHour, roundedMinutes, 0, 0);

    const targetEnd = new Date(targetDate);
    targetEnd.setHours(targetEnd.getHours() + 1); // Default 1 hour shift

    // Find the first free layer for this day & time range
    const startMs = targetDate.getTime();
    const endMs = targetEnd.getTime();
    
    const dayShifts = shifts.filter((s) => {
      return new Date(s.start_time).toDateString() === targetDate.toDateString();
    });

    let layer = 0;
    while (true) {
      const hasOverlap = dayShifts.some((s) => {
        const sLayer = parseInt(s.station, 10) || 0;
        if (sLayer !== layer) return false;
        const sStart = new Date(s.start_time).getTime();
        const sEnd = new Date(s.end_time).getTime();
        return startMs < sEnd && endMs > sStart;
      });

      if (!hasOverlap) {
        break;
      }
      layer++;
    }

    // Check if the drop overlaps with a blocked day tag
    const dayTag = getTagForDay(dayName);
    if (dayTag && isShiftInBlockedRange(targetDate.toISOString(), targetEnd.toISOString(), dayTag)) {
      const parsed = parseDayTagTimes(dayTag);
      setCalendarError(`Cannot schedule shift! The store is closed during this time due to: ${dayTag.tag_type === 'holiday' ? 'Holiday' : dayTag.tag_type === 'end_early' ? 'Ends Early' : 'Opens Late'} (${parsed.startTime} - ${parsed.endTime}).`);
      setDraggedEmployee(null);
      return;
    }

    onAddShift({
      staffId: draggedEmployee.id,
      station: String(layer),
      start: targetDate.toISOString(),
      end: targetEnd.toISOString(),
    });

    setDraggedEmployee(null);
  };

  // Pointer interaction handlers for Drag & Resize
  const handlePointerDown = (e, shift, type) => {
    if (!isAdmin) return;
    e.stopPropagation();
    e.preventDefault();

    setActiveDrag({
      shiftId: shift.id,
      type,
      initialX: e.clientX,
      initialStart: shift.start_time,
      initialEnd: shift.end_time,
      currentStart: shift.start_time,
      currentEnd: shift.end_time,
      shift,
      collidedWith: null,
    });
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!activeDrag) return;

      const track = containerRef.current?.querySelector('.timeline-track');
      if (!track) return;

      const trackWidth = track.getBoundingClientRect().width;
      const deltaX = e.clientX - activeDrag.initialX;
      
      const deltaMinutes = Math.round((deltaX / trackWidth) * TOTAL_HOURS * 60 / 5) * 5; // Snap to 5 min

      const newStart = new Date(activeDrag.initialStart);
      const newEnd = new Date(activeDrag.initialEnd);

      if (activeDrag.type === 'move') {
        newStart.setMinutes(newStart.getMinutes() + deltaMinutes);
        newEnd.setMinutes(newEnd.getMinutes() + deltaMinutes);
      } else if (activeDrag.type === 'resize-left') {
        newStart.setMinutes(newStart.getMinutes() + deltaMinutes);
        if (newStart >= newEnd) return;
      } else if (activeDrag.type === 'resize-right') {
        newEnd.setMinutes(newEnd.getMinutes() + deltaMinutes);
        if (newEnd <= newStart) return;
      }

      // Constrain within the same day
      if (newStart.getDate() !== new Date(activeDrag.initialStart).getDate()) {
        return;
      }

      // Find other shifts of the same employee on this day to check for collision/snapping
      const employeeOtherShifts = shifts.filter(s =>
        s.id !== activeDrag.shiftId &&
        s.staff_id === activeDrag.shift.staff_id &&
        new Date(s.start_time).getDate() === new Date(activeDrag.initialStart).getDate()
      );

      let collidedWith = null;

      if (activeDrag.type === 'resize-right') {
        const nextShift = employeeOtherShifts
          .filter(s => new Date(s.start_time) >= newStart)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

        if (nextShift) {
          const nextStart = new Date(nextShift.start_time);
          if (newEnd >= nextStart) {
            newEnd.setTime(nextStart.getTime());
            collidedWith = nextShift;
          }
        }
      } else if (activeDrag.type === 'resize-left') {
        const prevShift = employeeOtherShifts
          .filter(s => new Date(s.end_time) <= newEnd)
          .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0];

        if (prevShift) {
          const prevEnd = new Date(prevShift.end_time);
          if (newStart <= prevEnd) {
            newStart.setTime(prevEnd.getTime());
            collidedWith = prevShift;
          }
        }
      } else if (activeDrag.type === 'move') {
        const duration = newEnd.getTime() - newStart.getTime();
        if (deltaMinutes > 0) {
          const nextShift = employeeOtherShifts
            .filter(s => new Date(s.start_time) >= new Date(activeDrag.initialEnd))
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

          if (nextShift) {
            const nextStart = new Date(nextShift.start_time);
            if (newEnd >= nextStart) {
              newEnd.setTime(nextStart.getTime());
              newStart.setTime(nextStart.getTime() - duration);
              collidedWith = nextShift;
            }
          }
        } else if (deltaMinutes < 0) {
          const prevShift = employeeOtherShifts
            .filter(s => new Date(s.end_time) <= new Date(activeDrag.initialStart))
            .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0];

          if (prevShift) {
            const prevEnd = new Date(prevShift.end_time);
            if (newStart <= prevEnd) {
              newStart.setTime(prevEnd.getTime());
              newEnd.setTime(prevEnd.getTime() + duration);
              collidedWith = prevShift;
            }
          }
        }
      }

      setActiveDrag(prev => ({
        ...prev,
        currentStart: newStart.toISOString(),
        currentEnd: newEnd.toISOString(),
        collidedWith: collidedWith ? {
          id: collidedWith.id,
          start_time: collidedWith.start_time,
          end_time: collidedWith.end_time
        } : null
      }));
    };

    const handlePointerUp = async () => {
      if (!activeDrag) return;

      const { shiftId, currentStart, currentEnd, shift, collidedWith } = activeDrag;

      // Find the resolved laneIndex of the shift at its final position
      const date = new Date(currentStart);
      const options = { weekday: 'long' };
      const dayName = new Intl.DateTimeFormat('en-US', options).format(date);

      // Check tag overlap
      const dayTag = getTagForDay(dayName);
      if (dayTag && isShiftInBlockedRange(currentStart, currentEnd, dayTag)) {
        const parsed = parseDayTagTimes(dayTag);
        setCalendarError(`Cannot update shift! The store is closed during this time due to: ${dayTag.tag_type === 'holiday' ? 'Holiday' : dayTag.tag_type === 'end_early' ? 'Ends Early' : 'Opens Late'} (${parsed.startTime} - ${parsed.endTime}).`);
        setActiveDrag(null);
        return;
      }
      
      const { shifts: resolvedDayShifts } = processDayShifts(dayName);
      const resolvedShift = resolvedDayShifts.find(s => s.id === shiftId);
      const finalLaneIndex = resolvedShift ? resolvedShift.laneIndex : 0;

      setActiveDrag(null);

      if (collidedWith) {
        // Prepare combine state
        const times = [
          new Date(currentStart).getTime(),
          new Date(currentEnd).getTime(),
          new Date(collidedWith.start_time).getTime(),
          new Date(collidedWith.end_time).getTime()
        ];
        const minTime = new Date(Math.min(...times));
        const maxTime = new Date(Math.max(...times));

        setPendingMerge({
          shiftIdToKeep: shiftId,
          shiftIdToDelete: collidedWith.id,
          newStart: minTime.toISOString(),
          newEnd: maxTime.toISOString(),
          staffName: shift.profiles?.full_name || 'Staff',
          displayStart: formatDate(minTime.toISOString(), 'time24'),
          displayEnd: formatDate(maxTime.toISOString(), 'time24'),
          fallbackStart: currentStart,
          fallbackEnd: currentEnd,
        });
      } else if (currentStart !== shift.start_time || currentEnd !== shift.end_time || String(finalLaneIndex) !== shift.station) {
        const oldLayer = parseInt(shift.station, 10) || 0;
        try {
          await onUpdateShift({
            id: shiftId,
            staffId: shift.staff_id,
            station: String(finalLaneIndex),
            start: currentStart,
            end: currentEnd,
            silent: true,
          });
        } catch (err) {
          console.error('Failed to update shift after drag:', err);
        }

        // Layer compaction: if the shift moved to a different layer, check
        // whether the old layer is now empty for this day. If so, compact
        // all shifts above the vacated layer down by 1.
        if (finalLaneIndex !== oldLayer) {
          const dayDateStr = new Date(currentStart).toDateString();
          // Get the remaining shifts on that day AFTER the move (exclude the dragged one)
          const remainingDayShifts = shifts.filter(s =>
            s.id !== shiftId &&
            new Date(s.start_time).toDateString() === dayDateStr
          );

          const oldLayerIsEmpty = !remainingDayShifts.some(s => {
            const l = parseInt(s.station, 10);
            return !isNaN(l) && l === oldLayer;
          });

          if (oldLayerIsEmpty) {
            // Compact: every shift above the vacated layer moves down by 1
            const shiftsToCompact = remainingDayShifts.filter(s => {
              const l = parseInt(s.station, 10);
              return !isNaN(l) && l > oldLayer;
            });

            for (const s of shiftsToCompact) {
              const newLayer = parseInt(s.station, 10) - 1;
              try {
                await onUpdateShift({
                  id: s.id,
                  staffId: s.staff_id,
                  station: String(newLayer),
                  start: s.start_time,
                  end: s.end_time,
                  silent: true,
                });
              } catch (err) {
                console.error('Failed to compact layer for shift', s.id, err);
              }
            }
          }
        }
      }
    };

    if (activeDrag) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, onUpdateShift, shifts]);

  const handleConfirmMerge = async () => {
    if (!pendingMerge) return;
    const { shiftIdToKeep, shiftIdToDelete, newStart, newEnd } = pendingMerge;
    setPendingMerge(null);
    try {
      await onMergeShifts(shiftIdToKeep, shiftIdToDelete, newStart, newEnd);
    } catch (err) {
      console.error('Failed to merge shifts:', err);
    }
  };

  const handleCancelMerge = async () => {
    if (!pendingMerge) return;
    const { shiftIdToKeep, fallbackStart, fallbackEnd } = pendingMerge;
    setPendingMerge(null);

    const shift = shifts.find(s => s.id === shiftIdToKeep);
    if (shift) {
      // Find the resolved laneIndex of the shift at fallback times
      const date = new Date(fallbackStart);
      const options = { weekday: 'long' };
      const dayName = new Intl.DateTimeFormat('en-US', options).format(date);
      
      const dayShifts = shifts.filter((s) => {
        const d = new Date(s.start_time);
        const sd = new Intl.DateTimeFormat('en-US', options).format(d);
        return sd.toLowerCase() === dayName.toLowerCase();
      }).map(s => {
        if (s.id === shiftIdToKeep) {
          return { ...s, start_time: fallbackStart, end_time: fallbackEnd };
        }
        return s;
      });

      const { shifts: resolvedDayShifts } = resolveLayerCollisions(dayShifts);
      const resolvedShift = resolvedDayShifts.find(s => s.id === shiftIdToKeep);
      const finalLaneIndex = resolvedShift ? resolvedShift.laneIndex : 0;

      try {
        await onUpdateShift({
          id: shiftIdToKeep,
          staffId: shift.staff_id,
          station: String(finalLaneIndex),
          start: fallbackStart,
          end: fallbackEnd,
          silent: true,
        });
      } catch (err) {
        console.error('Failed to save snap position:', err);
      }
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* 1. Drag & Drop Employee Tray (Admin only) */}
      {isAdmin && (
        <div className="card bg-surface border border-border p-5 rounded-2xl space-y-4">
          {admins.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                Admins:
              </h4>
              <div className="flex flex-wrap gap-2">
                {admins.map((user) => {
                  const colors = getEmployeeColor(user.id, isDark);
                  const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
                  return (
                    <div
                      key={user.id}
                      draggable
                      onDragStart={(e) => handleEmployeeDragStart(e, user)}
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      className="border hover:brightness-110 pl-1.5 pr-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-grab active:cursor-grabbing select-none transition-all flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-white/20 select-none">{initials}</span>
                      {user.full_name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {staff.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <h4 className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                Staff Members:
              </h4>
              <div className="flex flex-wrap gap-2">
                {staff.map((user) => {
                  const colors = getEmployeeColor(user.id, isDark);
                  const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
                  return (
                    <div
                      key={user.id}
                      draggable
                      onDragStart={(e) => handleEmployeeDragStart(e, user)}
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      className="border hover:brightness-110 pl-1.5 pr-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-grab active:cursor-grabbing select-none transition-all flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-white/20 select-none">{initials}</span>
                      {user.full_name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Excel-like Schedule Timetable Grid */}
      <div className="w-full overflow-x-auto rounded-2xl border border-border shadow-xl">
        <div className="bg-surface min-w-[1200px] overflow-hidden">
        {/* Hours Header Row */}
        <div className="grid grid-cols-[110px_24px_1fr] bg-background border-b border-border">
          <div className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider px-6 py-4 flex items-center">
            Days
          </div>
          <div className="bg-background" />
          <div className="grid w-full relative pr-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
            {HOURS.map((h) => (
              <div key={h} className="text-center font-mono text-[9px] text-[var(--text-secondary)] py-4 border-l border-border/40 first:border-l-0 select-none">
                {`${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
        </div>

        {/* Days Timetable Grid */}
        <div className="flex flex-col">
          {orderedDays.map((dayName, dayIdx) => {
            const dayTag = getTagForDay(dayName);
            const { shifts: dayShifts, totalLanes, originalLanes } = processDayShifts(dayName);
            const isHoliday = dayTag?.tag_type === 'holiday';

            const LANE_H = 48;
            const displayLanes = Math.max(1, totalLanes);
            const trackHeight = displayLanes * LANE_H + 12;
            const MAX_VISIBLE_LANES = 3;
            const visibleHeight = totalLanes > MAX_VISIBLE_LANES
              ? (MAX_VISIBLE_LANES * LANE_H + 6)
              : trackHeight;
            const showSidebarNumbers = totalLanes > 1 || (totalLanes > 0 && (originalLanes[0] !== 0 || selectedStaffIds.length > 0 || !showAdmins || !showStaff));
            const hasMultipleLanes = totalLanes > 1;

            // Compute actual calendar date for this day
            const actualDate = new Date(currentWeekStart);
            actualDate.setDate(actualDate.getDate() + dayIdx);
            const dateLabel = actualDate.toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric'
            });

             return (
              <div
                key={dayName}
                className="grid grid-cols-[110px_24px_1fr] border-b border-border last:border-b-0"
              >
                {/* Y-Axis Label: Day name + date */}
                <div className="flex flex-col gap-0.5 justify-center px-5 py-3 bg-[var(--surface-raised)]/60 border-r border-border/40 select-none min-h-[60px]">
                  <span className="text-sm font-bold text-[var(--text-primary)] leading-tight">{dayName}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono tracking-wide">{dateLabel}</span>

                </div>

                {/* Layer number sidebar — syncs scroll with timeline */}
                <div
                  style={{ height: `${visibleHeight}px` }}
                  className="layer-sidebar bg-[var(--surface-raised)]/60 overflow-y-auto overflow-x-hidden select-none border-r border-border/40"
                  onScroll={(e) => {
                    const next = e.currentTarget.nextElementSibling;
                    if (next) next.scrollTop = e.currentTarget.scrollTop;
                  }}
                >
                  <div style={{ height: `${trackHeight}px` }} className="relative">
                    {showSidebarNumbers && originalLanes.map((origLane, i) => (
                      <div
                        key={i}
                        className="absolute inset-x-0 flex items-center justify-center"
                        style={{ top: `${i * LANE_H + 6}px`, height: `${LANE_H}px` }}
                      >
                        <span className="text-[9px] font-mono font-semibold text-[var(--text-secondary)] opacity-50">
                          {origLane + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline Track */}
                <div
                  onDragOver={handleDragOverTrack}
                  onDrop={(e) => handleDropOnTrack(e, dayName)}
                  style={{ height: `${visibleHeight}px` }}
                  onScroll={(e) => {
                    const prev = e.currentTarget.previousElementSibling;
                    if (prev) prev.scrollTop = e.currentTarget.scrollTop;
                  }}
                  className={`timeline-track relative w-full bg-[var(--surface-raised)]/20 overflow-y-auto select-none transition-all duration-200 ${
                    isHoliday ? 'bg-amber-500/10' : ''
                  }`}
                >
                  {/* Force full scroll height */}
                  <div style={{ height: `${trackHeight}px`, width: '1px' }} className="absolute left-0 top-0 pointer-events-none" />

                  {/* Lane background bands — only when multiple lanes exist */}
                  {hasMultipleLanes && Array.from({ length: totalLanes }, (_, i) => (
                    <div
                      key={`lane-bg-${i}`}
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: `${i * LANE_H + 6}px`,
                        height: `${LANE_H}px`,
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      }}
                    />
                  ))}



                  {/* Lane divider lines — only when multiple lanes */}
                  {hasMultipleLanes && Array.from({ length: totalLanes - 1 }, (_, i) => (
                    <div
                      key={`lane-div-${i}`}
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: `${(i + 1) * LANE_H + 6}px`,
                        height: '1px',
                        background: 'linear-gradient(to right, transparent 0%, var(--border) 5%, var(--border) 95%, transparent 100%)',
                      }}
                    />
                  ))}

                  {/* Vertical hour grid lines */}
                  <div className="absolute inset-0 grid pointer-events-none pr-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', height: `${trackHeight}px` }}>
                    {HOURS.map((h) => (
                      <div key={h} className="h-full border-l border-border/20 first:border-l-0" />
                    ))}
                  </div>

                  {/* Holiday tag display */}
                  {isHoliday ? (
                    <div className="absolute inset-0 bg-warning-bg border-l-4 border-l-warning flex items-center px-6 text-xs font-bold text-warning">
                      ★ HOLIDAY: {dayTag.description || 'Closed'}
                    </div>
                  ) : (
                    <>
                      {/* Blocked store hours overlay */}
                      {dayTag && dayTag.tag_type !== 'holiday' && (() => {
                        const blocks = parseDayTagTimes(dayTag);
                        return blocks.map((block, idx) => {
                          const pos = getTagPositionStyles(block.startTime, block.endTime);
                          const isEndEarly = block.endTime === '24:00';
                          return (
                            <div
                              key={`blocked-overlay-${idx}`}
                              style={{ ...pos, height: `${trackHeight}px` }}
                              className="absolute blocked-track-overlay flex flex-col items-center justify-center text-center p-2 z-10 select-none pointer-events-none"
                            >
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-warning leading-none">
                                ★ {isEndEarly ? 'Ends Early' : 'Opens Late'}
                              </span>
                              <span className="text-[8px] font-bold text-warning/80 font-mono mt-1 leading-none">
                                {block.startTime} - {block.endTime}
                              </span>
                              {block.reason && (
                                <span className="text-[8px] text-[var(--text-primary)] font-bold mt-1.5 leading-none max-w-xs truncate">
                                  {block.reason}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {dayShifts.map((shift) => {
                        const isOwnShift = shift.staff_id === currentUserId;
                        const staffName = shift.profiles?.full_name || 'Staff';
                        const isPendingSwap = pendingSwaps.some(
                          (swap) => swap.requester_shift_id === shift.id || swap.target_shift_id === shift.id
                        );

                        const posStyles = getPositionStyles(shift.start_time, shift.end_time, shift.id, shift.uiLaneIndex);
                        const colors = getEmployeeColor(shift.staff_id, isDark);

                        const durationHours = (new Date(shift.end_time) - new Date(shift.start_time)) / (1000 * 60 * 60);
                        const showTime = durationHours >= 2.0;

                        return (
                          <div
                            key={shift.id}
                            style={{
                              ...posStyles,
                              backgroundColor: isPendingSwap ? 'transparent' : colors.bg,
                              borderColor: colors.border,
                              color: colors.text,
                            }}
                            title={`${staffName} (${formatDate(shift.start_time, 'time24')} - ${formatDate(shift.end_time, 'time24')})`}
                            onPointerDown={(e) => handlePointerDown(e, shift, 'move')}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isAdmin) {
                                onUpdateShift({
                                  id: shift.id,
                                  staffId: shift.staff_id,
                                  staffName,
                                  station: shift.station,
                                  start: shift.start_time,
                                  end: shift.end_time,
                                  isOwnShift,
                                });
                              } else if (!isOwnShift) {
                                onSelectColleagueShift({
                                  id: shift.id,
                                  staffId: shift.staff_id,
                                  staffName,
                                  station: shift.station,
                                  start: shift.start_time,
                                  end: shift.end_time,
                                  isOwnShift,
                                });
                              }
                            }}
                            className={`absolute rounded-xl border px-3 py-1 flex flex-col justify-center text-left select-none ${
                              isPendingSwap
                                ? 'border-dashed text-[var(--text-primary)] animate-pulse'
                                : ''
                            } ${
                              isOwnShift ? 'border-l-4' : ''
                            } hover:brightness-105 shadow-md shadow-black/20 cursor-grab active:cursor-grabbing`}
                          >
                            {/* Resize Left Handle */}
                            {isAdmin && (
                              <div
                                onPointerDown={(e) => handlePointerDown(e, shift, 'resize-left')}
                                className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-[var(--accent)]/40 cursor-ew-resize rounded-l-xl z-10"
                              />
                            )}

                            {/* Content */}
                            <div className="font-bold text-xs truncate pointer-events-none leading-none">
                              {staffName}
                            </div>
                            {showTime && (
                              <div className="text-[9px] opacity-75 font-bold uppercase tracking-wider pointer-events-none mt-0.5 font-mono leading-none">
                                {formatDate(shift.start_time, 'time24')} - {formatDate(shift.end_time, 'time24')}
                              </div>
                            )}

                            {/* Resize Right Handle */}
                            {isAdmin && (
                              <div
                                onPointerDown={(e) => handlePointerDown(e, shift, 'resize-right')}
                                className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-[var(--accent)]/40 cursor-ew-resize rounded-r-xl z-10"
                              />
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>




      {/* Merge Confirmation Dialog Modal */}
      {pendingMerge && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Combine Shifts?</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Would you like to combine these two shifts for <strong>{pendingMerge.staffName}</strong> into a single continuous shift from <strong>{pendingMerge.displayStart}</strong> to <strong>{pendingMerge.displayEnd}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelMerge}
                className="btn btn-ghost px-4 h-10 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                No, Keep Separate
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                className="btn btn-primary btn-premium px-5 h-10 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/5"
              >
                Yes, Combine
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarError && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle size={20} className="text-destructive" />
              <span>Schedule Conflict</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {calendarError}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCalendarError(null)}
                className="btn btn-primary px-5 h-10 text-xs font-bold rounded-xl cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
