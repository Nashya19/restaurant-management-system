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
        className="w-full h-[40px] flex items-center gap-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-4 hover:border-[var(--accent)] transition-colors focus:outline-none focus:border-[var(--accent)]"
      >
        {Icon && <Icon size={18} className="text-[var(--text-secondary)]" />}
        <span className="flex-1 text-left text-[var(--text-primary)] text-[14px]">{selectedOption.label}</span>
        <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-[var(--surface-raised)] transition-colors ${
                value === opt.value ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-primary)]'
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
