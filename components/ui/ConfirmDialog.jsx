'use client';

export default function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  confirmStyle = 'btn-danger' 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity">
      <div className="card w-full max-w-sm bg-[var(--surface)] border-[var(--border)] shadow-2xl rounded-[var(--radius-md)] overflow-hidden transition-transform">
        <div className="p-6">
          <h3 className="text-heading mb-2 text-[var(--text-primary)]">{title}</h3>
          <p className="text-body text-[var(--text-secondary)] mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="btn btn-ghost px-4 py-2">{cancelText}</button>
            <button onClick={onConfirm} className={`btn ${confirmStyle} px-4 py-2`}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
