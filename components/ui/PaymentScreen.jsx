'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';
import { CheckCircle2, Loader2, QrCode as QrCodeIcon, IndianRupee, ShieldCheck, XCircle } from 'lucide-react';
import { clearTableSessionAction, createRazorpayOrderAction } from '@/lib/actions/orders';

/**
 * PaymentScreen — shown on the customer-facing order page when
 * the session status is "completed" (bill generated, awaiting payment).
 */
export default function PaymentScreen({ session, tableNumber, onConfirm, isConfirming }) {
  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);

  // Razorpay Integration States
  const [isProcessingRazorpay, setIsProcessingRazorpay] = useState(false);

  // Build a fake UPI deep-link
  const upiId = 'saute.restaurant@upi';
  const amount = (session?.running_total || 0).toFixed(2);
  const txnNote = encodeURIComponent(`Table ${tableNumber} — Bill`);
  const upiLink = `upi://pay?pa=${upiId}&pn=Saute+Restaurant&am=${amount}&cu=INR&tn=${txnNote}`;

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

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const startRazorpayPayment = async () => {
    if (isConfirming || isProcessingRazorpay) return;
    setIsProcessingRazorpay(true);

    try {
      // 1. Call server action to get/create order
      const orderData = await createRazorpayOrderAction(session.id);
      
      // 2. Load script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert('Failed to load Razorpay payment gateway. Please check your internet connection.');
        setIsProcessingRazorpay(false);
        return;
      }

      // 3. Configure Razorpay options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Sauté Restaurant',
        description: `Table ${tableNumber} Bill Payment`,
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=120&h=120&q=80',
        handler: async function (response) {
          setIsProcessingRazorpay(true);
          try {
            // Payment succeeded! Auto-confirm/clear table session
            if (session?.id) {
              await clearTableSessionAction(session.id);
              localStorage.removeItem('sessionId');
            }
            window.location.href = `/table/${tableNumber}/feedback?payment_method=razorpay&payment_id=${response.razorpay_payment_id}`;
          } catch (err) {
            console.error('[Razorpay Callback] Failed to clear session:', err);
            alert('Payment succeeded but table status update failed. Please inform the staff.');
            setIsProcessingRazorpay(false);
          }
        },
        prefill: {
          name: `Table ${tableNumber} Customer`,
          email: 'customer@example.com',
          contact: '9999999999'
        },
        notes: {
          table_number: tableNumber,
          session_id: session.id
        },
        theme: {
          color: '#3399FF'
        }
      };

      // Only append order_id if it's not a fallback/mock order id
      if (orderData.success && !orderData.fallback) {
        options.order_id = orderData.orderId;
      }

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        console.warn('[Razorpay Payment Failed]', response.error);
        alert(`Payment Failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (err) {
      console.error('[Razorpay Payment Launch Error]', err);
      alert('Failed to initiate Razorpay checkout.');
    } finally {
      setIsProcessingRazorpay(false);
    }
  };

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
            <div className="flex items-center gap-3">
              <img 
                src="/images/logo.png" 
                alt="Sauté Logo" 
                className="w-10 h-10 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)] shrink-0" 
              />
              <div>
                <span className="text-[9px] font-black tracking-[0.25em] uppercase text-[var(--accent)] font-sans block leading-none mb-1">Sauté</span>
                <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">Your Bill</h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
                  Table {tableNumber} · PIN {session?.pin}
                </p>
              </div>
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
          {/* Hide Razorpay for the time being
          <button
            type="button"
            onClick={startRazorpayPayment}
            className="w-full bg-[#3399FF] hover:bg-[#2288EE] text-white flex items-center justify-center gap-2 rounded-xl h-12 font-bold cursor-pointer transition-colors shadow-md text-sm border-0"
          >
            <ShieldCheck size={16} />
            <span>Pay via Razorpay (Test Mode)</span>
          </button>
          */}

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="w-full btn btn-success btn-premium flex items-center justify-center gap-2 rounded-xl h-12 font-bold cursor-pointer disabled:opacity-60 text-sm"
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
