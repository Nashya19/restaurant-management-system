'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';
import { CheckCircle2, Loader2, QrCode as QrCodeIcon } from 'lucide-react';

/**
 * PaymentScreen — shown on the customer-facing order page when
 * the session status is "completed" (bill generated, awaiting payment).
 *
 * Props:
 *   session       — session object from getSessionDetailsAction
 *   tableNumber   — string, e.g. "3"
 *   onConfirm     — async fn called when customer taps "I've Paid"
 *   isConfirming  — bool, while the confirm action is running
 */
export default function PaymentScreen({ session, tableNumber, onConfirm, isConfirming }) {
  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);

  // Build a fake UPI deep-link
  const upiId = 'zenith.restaurant@upi';
  const amount = (session?.running_total || 0).toFixed(2);
  const txnNote = encodeURIComponent(`Table ${tableNumber} — Bill`);
  const upiLink = `upi://pay?pa=${upiId}&pn=Zenith+Restaurant&am=${amount}&cu=INR&tn=${txnNote}`;

  // Render QR into <canvas> client-side only
  useEffect(() => {
    let cancelled = false;
    async function renderQR() {
      try {
        const QRCode = (await import('qrcode')).default;
        if (!cancelled && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, upiLink, {
            width: 240,
            margin: 2,
            color: {
              dark: '#1A1714',   // matches --text-primary (light theme)
              light: '#FAFAF8',  // matches --background (light theme)
            },
          });
          setQrReady(true);
        }
      } catch (err) {
        console.error('[QR] Failed to render:', err);
      }
    }
    renderQR();
    return () => { cancelled = true; };
  }, [upiLink]);

  // Flatten all order items across every order into a single bill list
  const billLines = [];
  (session?.orders || []).forEach((order) => {
    (order.items || []).forEach((item) => {
      const existing = billLines.find((l) => l.name === item.name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.subtotal += item.subtotal;
      } else {
        billLines.push({ name: item.name, quantity: item.quantity, subtotal: item.subtotal, price: item.price_at_order });
      }
    });
  });

  const grandTotal = session?.running_total || 0;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-start py-10 px-4">
      {/* Top animated success banner */}
      <div className="w-full max-w-md mb-6 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success-border)',
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 size={14} />
          Ordering Complete — Please Pay
        </div>
      </div>

      {/* Receipt card */}
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Your Bill</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
                Table {tableNumber} · PIN {session?.pin}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">Session</p>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                #{session?.id?.substring(0, 8)}
              </p>
            </div>
          </div>
        </div>

        {/* Order Line Items */}
        <div className="px-6 py-4 space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-3">
            Order Summary
          </p>
          {billLines.length > 0 ? (
            billLines.map((line, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{line.name}</span>
                  <span className="text-xs text-[var(--text-secondary)] font-mono ml-2">× {line.quantity}</span>
                </div>
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                  {formatCurrency(line.subtotal)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">No items found.</p>
          )}
        </div>

        {/* Grand Total */}
        <div className="mx-6 mb-4 bg-[rgba(var(--accent-rgb),0.08)] border border-[rgba(var(--accent-rgb),0.2)] rounded-xl px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
            Grand Total
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--accent)]">
            {formatCurrency(grandTotal)}
          </p>
        </div>

        {/* QR Code section */}
        <div className="px-6 pb-6 flex flex-col items-center gap-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">
            Scan to Pay via UPI
          </p>

          <div className="relative flex items-center justify-center w-[240px] h-[240px] bg-background rounded-xl border border-[var(--border)] overflow-hidden">
            {!qrReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-xs font-medium">Generating QR…</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={`transition-opacity duration-300 ${qrReady ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>

          <div className="text-center space-y-0.5">
            <p className="text-xs font-mono font-semibold text-[var(--text-primary)]">{upiId}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Scan with any UPI app to pay</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-[var(--border)] mx-6" />

        {/* Confirm payment button */}
        <div className="px-6 py-5 space-y-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="w-full btn btn-success btn-premium flex items-center justify-center gap-2 rounded-xl h-12 font-bold cursor-pointer disabled:opacity-60"
          >
            {isConfirming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>I've Paid — Continue</span>
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-[var(--text-muted)]">
            Tap after completing payment. You'll be asked for a quick feedback before we close your session.
          </p>
        </div>
      </div>
    </div>
  );
}
