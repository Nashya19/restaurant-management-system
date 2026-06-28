'use client';

import React from 'react';
import { AlertCircle, HelpCircle, Info } from 'lucide-react';

export default function CustomAlertConfirm({
  type = 'alert', // 'alert' | 'confirm'
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-surface border border-border p-6 rounded-2xl shadow-2xl space-y-4 scale-in-center">
        <div className="flex items-start gap-3">
          {type === 'confirm' ? (
            <HelpCircle size={22} className="text-[var(--accent)] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={22} className="text-destructive shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {title || (type === 'confirm' ? 'Confirm Action' : 'Notice')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-1.5">
          {type === 'confirm' && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost px-4 h-9 text-xs font-bold rounded-xl cursor-pointer border border-border bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`btn px-4 h-9 text-xs font-bold rounded-xl cursor-pointer transition-all ${
              type === 'confirm'
                ? 'btn-primary btn-premium bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/10 hover:brightness-110'
                : 'bg-surface-raised text-[var(--text-primary)] border border-border hover:bg-border'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
