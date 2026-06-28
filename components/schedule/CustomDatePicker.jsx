'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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
};

export default function CustomDatePicker({ value, onChange, label, selectionMode = 'day', weekStartDay = 1 }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse value (YYYY-MM-DD) into Date object, default to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : new Date();
  
  // Navigation state (for browsing months)
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());

  const [tempDate, setTempDate] = useState(null);

  // Sync navigation view with value change
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
      setTempDate(d);
    } else {
      setTempDate(null);
    }
  }, [value, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to get number of days in month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get day index of first day of month (0 = Sun, 1 = Mon...)
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleSelectDay = (day, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const yearStr = String(currentYear);
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    
    const formattedDate = `${yearStr}-${monthStr}-${dayStr}`;
    
    if (selectionMode === 'week') {
      const clickedDate = new Date(formattedDate + 'T00:00:00');
      const start = getWeekStart(clickedDate, weekStartDay);
      setTempDate(start);
    } else {
      onChange(formattedDate);
      setIsOpen(false);
    }
  };

  // Generate calendar grid array
  const totalDays = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);
  
  const calendarCells = [];
  // Empty padding cells for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Actual day cells
  for (let i = 1; i <= totalDays; i++) {
    calendarCells.push(i);
  }

  // Format date for display: DD / MM / YYYY
  const getDisplayValue = () => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day} / ${month} / ${d.getFullYear()}`;
  };

  const isToday = (day) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  };

  const isDayInSelectedWeek = (day) => {
    if (!tempDate) return false;
    const cellDate = new Date(currentYear, currentMonth, day);
    const startOfWeek = getWeekStart(tempDate, weekStartDay);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    cellDate.setHours(0, 0, 0, 0);
    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return cellDate >= startOfWeek && cellDate <= endOfWeek;
  };

  const isSelected = (day) => {
    if (selectionMode === 'week') {
      return isDayInSelectedWeek(day);
    }
    if (!value) return false;
    const d = new Date(value + 'T00:00:00');
    return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      {/* Date Input Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-background border border-border hover:border-border focus-within:border-[var(--accent)] rounded-xl flex items-center justify-between px-3 h-11 text-sm text-[var(--text-primary)] cursor-pointer outline-none transition-all select-none"
      >
        <span className="font-mono">{label ? `${label} ${getDisplayValue()}` : (getDisplayValue() || 'Select Date')}</span>
        <Calendar size={16} className="text-[var(--text-secondary)]" />
      </div>

      {/* Calendar Dropdown Card */}
      {isOpen && (
        <div className="absolute z-[999] left-0 mt-1.5 p-4 w-72 bg-surface border border-border rounded-2xl shadow-2xl space-y-4 select-none">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 border border-border hover:border-border bg-background rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {months[currentMonth]} {currentYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 border border-border hover:border-border bg-background rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Week Days Label Header */}
          <div className="grid grid-cols-7 text-center">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={(e) => handleSelectDay(day, e)}
                  className={`h-8 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer flex items-center justify-center border ${
                    selected
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-black font-bold shadow-md shadow-[var(--accent)]/15'
                      : today
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-transparent border-transparent text-[var(--text-primary)] hover:bg-surface-raised/50 hover:border-border'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* OK Button for week selection */}
          {selectionMode === 'week' && (
            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (tempDate) {
                    onChange(tempDate.toLocaleDateString('sv-SE'));
                  }
                  setIsOpen(false);
                }}
                className="btn btn-primary px-5 h-10 text-xs font-bold rounded-xl cursor-pointer"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
