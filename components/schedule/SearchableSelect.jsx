'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, Search } from 'lucide-react';

export default function SearchableSelect({
  options = [], // [{ id, full_name, role }]
  value, // String (single) or Array/Set (multi)
  onChange,
  placeholder = 'Select staff...',
  isMulti = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) =>
    opt.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (opt, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(opt.id)) {
        onChange(currentValues.filter((v) => v !== opt.id));
      } else {
        onChange([...currentValues, opt.id]);
      }
      setSearch('');
      inputRef.current?.focus();
    } else {
      onChange(opt.id);
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleRemoveValue = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter((v) => v !== id));
    } else {
      onChange('');
    }
  };

  // Get display text for single select
  const getSingleSelectDisplay = () => {
    if (isMulti) return '';
    const selectedOpt = options.find((opt) => opt.id === value);
    return selectedOpt ? selectedOpt.full_name : '';
  };

  const isSelected = (id) => {
    if (isMulti) {
      return Array.isArray(value) && value.includes(id);
    }
    return value === id;
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className="min-h-10 w-full bg-background border border-border hover:border-border focus-within:border-[var(--accent)] rounded-xl flex flex-wrap items-center gap-1.5 px-3 py-1.5 cursor-text transition-all"
      >
        {/* Render selected chips for multi select */}
        {isMulti && Array.isArray(value) && value.map((valId) => {
          const opt = options.find((o) => o.id === valId);
          if (!opt) return null;
          return (
            <span
              key={valId}
              className="inline-flex items-center gap-1 bg-surface border border-border text-xs font-semibold px-2 py-0.5 rounded-lg text-[var(--text-primary)]"
            >
              {opt.full_name}
              <button
                type="button"
                onClick={(e) => handleRemoveValue(valId, e)}
                className="hover:text-red-400 p-0.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          );
        })}

        {/* Input area */}
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : getSingleSelectDisplay()}
          placeholder={isMulti && Array.isArray(value) && value.length > 0 ? '' : placeholder}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] min-w-[80px] p-0 focus:ring-0"
        />

        <div className="flex items-center gap-1 shrink-0 text-[var(--text-secondary)]">
          {(!isMulti && value) && (
            <button
              type="button"
              onClick={(e) => handleRemoveValue(value, e)}
              className="hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-background border border-border rounded-xl shadow-2xl overflow-hidden divide-y divide-border/40">
          {filteredOptions.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-[var(--text-secondary)] select-none">
              No results found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const selected = isSelected(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={(e) => handleSelect(opt, e)}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold cursor-pointer hover:bg-surface transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    {isMulti && (
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                        selected ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'border-border bg-transparent'
                      }`}>
                        {selected && <Check size={10} strokeWidth={3} />}
                      </div>
                    )}
                    <span className="text-[var(--text-primary)]">{opt.full_name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      opt.role === 'admin' ? 'bg-success-bg text-success' : 'bg-surface border border-border text-[var(--text-secondary)]'
                    }`}>
                      {opt.role}
                    </span>
                  </div>
                  {!isMulti && selected && (
                    <Check size={12} className="text-[var(--accent)]" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
