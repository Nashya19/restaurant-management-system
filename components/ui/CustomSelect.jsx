'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, icon: Icon, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 hover:border-[var(--accent)] transition-all duration-200 focus:outline-none cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-[var(--text-secondary)]" />}
          <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedOption.label}</span>
        </span>
        <ChevronDown size={14} className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--accent)]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer hover:bg-surface-raised ${
                value === opt.value ? 'text-[var(--accent)] font-bold bg-background/40' : 'text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
